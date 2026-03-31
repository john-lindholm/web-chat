#!/bin/bash
#
# AWS SSO Quick Setup Script
# Uses your existing IAM Identity Center instance in eu-north-1
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_header() { echo -e "\n${GREEN}=== $1 ===${NC}\n"; }
print_info() { echo -e "${YELLOW}→${NC} $1"; }
print_success() { echo -e "${GREEN}✓${NC} $1"; }
print_error() { echo -e "${RED}✗${NC} $1"; }

# Your existing Identity Center info
INSTANCE_ID="ssoins-6508d0d66a2a26f1"
IDENTITY_STORE_ID="d-c3672e9ab9"
ACCESS_PORTAL="https://d-c3672e9ab9.awsapps.com/start"
REGION="eu-north-1"

print_header "AWS SSO Quick Setup"
echo "Using your existing Identity Center instance:"
echo "  Instance: $INSTANCE_ID"
echo "  Portal: $ACCESS_PORTAL"
echo ""

# Get account ID
print_info "Getting account ID..."
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text 2>/dev/null)

if [ -z "$ACCOUNT_ID" ]; then
    print_error "Failed to get account ID. Check your AWS credentials."
    exit 1
fi

print_success "Account ID: $ACCOUNT_ID"

INSTANCE_ARN="arn:aws:sso:${REGION}:${ACCOUNT_ID}:instance/${INSTANCE_ID}"
print_success "Instance ARN: $INSTANCE_ARN"

# Get user info
print_header "User Information"
read -p "Enter your email address: " USER_EMAIL
read -p "Enter your display name: " USER_NAME

if [ -z "$USER_EMAIL" ] || [ -z "$USER_NAME" ]; then
    print_error "Email and name are required"
    exit 1
fi

# Get permission set name
print_header "Permission Set"
read -p "Enter permission set name (default: AdministratorAccess): " PERM_SET_NAME
PERM_SET_NAME=${PERM_SET_NAME:-AdministratorAccess}

# Check if permission set exists
print_info "Checking for existing permission set..."
EXISTING_PS=$(aws sso-admin list-permission-sets \
    --instance-arn $INSTANCE_ARN \
    --region $REGION \
    --query "PermissionSets[?ends_with(@, '/$PERM_SET_NAME')]|[0]" \
    --output text 2>/dev/null || echo "")

if [ -n "$EXISTING_PS" ] && [ "$EXISTING_PS" != "None" ]; then
    print_info "Permission set '$PERM_SET_NAME' already exists"
    PERM_SET_ARN=$EXISTING_PS
else
    print_info "Creating permission set: $PERM_SET_NAME"

    aws sso-admin create-permission-set \
        --instance-arn $INSTANCE_ARN \
        --name "$PERM_SET_NAME" \
        --description "Full admin access via SSO" \
        --managed-policies arn:aws:iam::aws:policy/AdministratorAccess \
        --session-duration 36000 \
        --region $REGION

    PERM_SET_ARN=$(aws sso-admin list-permission-sets \
        --instance-arn $INSTANCE_ARN \
        --region $REGION \
        --query "PermissionSets[?ends_with(@, '/$PERM_SET_NAME')]|[0]" \
        --output text)
fi

print_success "Permission Set ARN: $PERM_SET_ARN"

# Create or get user
print_header "User Setup"
print_info "Looking up user: $USER_EMAIL..."

USER_ID=$(aws identitystore list-users \
    --identity-store-id $IDENTITY_STORE_ID \
    --filters "UserName=$USER_EMAIL" \
    --query "Users[0].UserId" \
    --output text 2>/dev/null || echo "")

if [ -n "$USER_ID" ] && [ "$USER_ID" != "None" ] && [ "$USER_ID" != "" ]; then
    print_info "User already exists"
else
    print_info "Creating user..."
    USER_ID=$(aws identitystore create-user \
        --identity-store-id $IDENTITY_STORE_ID \
        --user-name "$USER_EMAIL" \
        --display-name "$USER_NAME" \
        --emails "Email={Type=Work,Value=$USER_EMAIL,Primary=true}" \
        --query UserId \
        --output text)
fi

print_success "User ID: $USER_ID"

# Assign user to permission set
print_header "Assigning Permissions"
print_info "Assigning $PERM_SET_NAME to $USER_EMAIL..."

# Check if already assigned
ASSIGNMENT_EXISTS=$(aws sso-admin list-account-assignments \
    --instance-arn $INSTANCE_ARN \
    --account-id $ACCOUNT_ID \
    --permission-set-arn $PERM_SET_ARN \
    --region $REGION \
    --query "AccountAssignments[?PrincipalId=='$USER_ID']|[0]" \
    --output text 2>/dev/null || echo "")

if [ -n "$ASSIGNMENT_EXISTS" ] && [ "$ASSIGNMENT_EXISTS" != "None" ]; then
    print_info "Assignment already exists"
else
    aws sso-admin create-account-assignment \
        --instance-arn $INSTANCE_ARN \
        --target-id $ACCOUNT_ID \
        --target-type AWS_ACCOUNT \
        --permission-set-arn $PERM_SET_ARN \
        --principal-type USER \
        --principal-id $USER_ID \
        --region $REGION

    print_info "Waiting for assignment to propagate..."
    sleep 3
fi

print_success "User assigned to permission set!"

# Generate AWS config
print_header "AWS CLI Configuration"

AWS_CONFIG_FILE="${HOME}/.aws/config"

# Create backup of existing config
if [ -f "$AWS_CONFIG_FILE" ]; then
    cp "$AWS_CONFIG_FILE" "${AWS_CONFIG_FILE}.bak"
    print_info "Backed up existing config to ${AWS_CONFIG_FILE}.bak"
fi

# Check if profile already exists
if grep -q "\[profile sso-admin\]" "$AWS_CONFIG_FILE" 2>/dev/null; then
    print_info "Profile 'sso-admin' already exists in config"
    read -p "Do you want to overwrite it? (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_info "Skipping config update"
        SKIP_CONFIG=true
    fi
fi

if [ "$SKIP_CONFIG" != "true" ]; then
    # Remove existing profile if present
    if grep -q "\[profile sso-admin\]" "$AWS_CONFIG_FILE" 2>/dev/null; then
        # Remove the profile section
        awk '
        /^\[profile sso-admin\]/ { skip=1; next }
        /^\[profile / { skip=0 }
        /^\[/ && !/^\[profile sso-admin\]/ { skip=0 }
        !skip { print }
        ' "$AWS_CONFIG_FILE" > "${AWS_CONFIG_FILE}.tmp"
        mv "${AWS_CONFIG_FILE}.tmp" "$AWS_CONFIG_FILE"
    fi

    # Append new profile
    cat >> "$AWS_CONFIG_FILE" << EOF

[profile sso-admin]
sso_start_url = $ACCESS_PORTAL
sso_region = $REGION
sso_account_id = $ACCOUNT_ID
sso_role_name = $PERM_SET_NAME
region = eu-west-1
output = json
EOF
    print_success "Added 'sso-admin' profile to ~/.aws/config"
fi

# Summary
print_header "Setup Complete!"

echo -e "${GREEN}========================================${NC}"
echo ""
echo "Your SSO Access Portal:"
echo -e "  ${YELLOW}$ACCESS_PORTAL${NC}"
echo ""
echo "AWS Config Profile:"
echo -e "  ${YELLOW}sso-admin${NC}"
echo ""
echo "Next steps:"
echo ""
echo "1. Check your email for the activation link"
echo ""
echo "2. Login with:"
echo -e "   ${YELLOW}aws sso login --profile sso-admin${NC}"
echo ""
echo "3. Test access:"
echo -e "   ${YELLOW}aws sts get-caller-identity --profile sso-admin${NC}"
echo ""
echo "4. Use with Copilot:"
echo -e "   ${YELLOW}copilot app show --profile sso-admin${NC}"
echo ""
echo -e "${GREEN}========================================${NC}"
