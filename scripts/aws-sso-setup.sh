#!/bin/bash
#
# AWS IAM Identity Center (SSO) Setup Script
# For single AWS account setup
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

print_header "AWS SSO Setup"

# Step 1: Check if Identity Center is enabled
print_info "Checking IAM Identity Center status..."
INSTANCE_INFO=$(aws sso-admin list-instances --region us-east-1 2>/dev/null || echo "{}")

if [ "$(echo $INSTANCE_INFO | jq -r '.Instances | length')" == "0" ]; then
    print_info "Enabling IAM Identity Center..."
    aws sso-admin create-instance --region us-east-1
    print_success "IAM Identity Center enabled"
else
    print_success "IAM Identity Center already enabled"
fi

# Get instance info
INSTANCE_ARN=$(aws sso-admin list-instances --region us-east-1 --query 'Instances[0].InstanceArn' --output text)
IDENTITY_STORE_ID=$(aws sso-admin list-instances --region us-east-1 --query 'Instances[0].IdentityStoreId' --output text)

print_success "Instance ARN: $INSTANCE_ARN"
print_success "Identity Store ID: $IDENTITY_STORE_ID"

# Step 2: Get account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
print_info "Account ID: $ACCOUNT_ID"

# Step 3: Create permission set
print_header "Creating Permission Set"

read -p "Enter permission set name (default: AdministratorAccess): " PERM_SET_NAME
PERM_SET_NAME=${PERM_SET_NAME:-AdministratorAccess}

# Check if permission set exists
EXISTING_PS=$(aws sso-admin list-permission-sets \
    --instance-arn $INSTANCE_ARN \
    --region us-east-1 \
    --query "PermissionSets[?contains(@, '$PERM_SET_NAME')]" \
    --output text)

if [ -n "$EXISTING_PS" ]; then
    print_info "Permission set '$PERM_SET_NAME' already exists"
    PERM_SET_ARN=$EXISTING_PS
else
    print_info "Creating permission set: $PERM_SET_NAME"

    # Create with AdministratorAccess managed policy
    aws sso-admin create-permission-set \
        --instance-arn $INSTANCE_ARN \
        --name "$PERM_SET_NAME" \
        --description "Full admin access via SSO" \
        --managed-policies arn:aws:iam::aws:policy/AdministratorAccess \
        --session-duration 36000 \
        --region us-east-1

    PERM_SET_ARN=$(aws sso-admin list-permission-sets \
        --instance-arn $INSTANCE_ARN \
        --region us-east-1 \
        --query "PermissionSets[?contains(@, '$PERM_SET_NAME')]|[0]" \
        --output text)
fi

print_success "Permission Set ARN: $PERM_SET_ARN"

# Step 4: Create user
print_header "Creating User"

read -p "Enter your email address: " USER_EMAIL
read -p "Enter your name: " USER_NAME

# Check if user exists
EXISTING_USER=$(aws identitystore list-users \
    --identity-store-id $IDENTITY_STORE_ID \
    --query "Users[?UserName=='$USER_EMAIL'].UserId" \
    --output text)

if [ -n "$EXISTING_USER" ]; then
    print_info "User '$USER_EMAIL' already exists"
    USER_ID=$EXISTING_USER
else
    print_info "Creating user: $USER_EMAIL"
    USER_ID=$(aws identitystore create-user \
        --identity-store-id $IDENTITY_STORE_ID \
        --user-name "$USER_EMAIL" \
        --display-name "$USER_NAME" \
        --emails "Email={Type=Work,Value=$USER_EMAIL,Primary=true}" \
        --query UserId \
        --output text)
fi

print_success "User ID: $USER_ID"

# Step 5: Assign user to permission set
print_header "Assigning Permissions"

print_info "Assigning $PERM_SET_NAME to $USER_EMAIL on account $ACCOUNT_ID..."

# Check if assignment already exists
aws sso-admin list-account-assignments \
    --instance-arn $INSTANCE_ARN \
    --account-id $ACCOUNT_ID \
    --permission-set-arn $PERM_SET_ARN \
    --region us-east-1 \
    --query "AccountAssignments[?PrincipalId=='$USER_ID']" \
    --output text > /dev/null 2>&1

if [ $? -eq 0 ]; then
    print_info "Assignment already exists"
else
    aws sso-admin create-account-assignment \
        --instance-arn $INSTANCE_ARN \
        --target-id $ACCOUNT_ID \
        --target-type AWS_ACCOUNT \
        --permission-set-arn $PERM_SET_ARN \
        --principal-type USER \
        --principal-id $USER_ID \
        --region us-east-1

    # Wait for assignment to complete
    print_info "Waiting for assignment to complete..."
    sleep 5
fi

print_success "User assigned to permission set"

# Step 6: Get access portal URL
print_header "Access Portal"

ACCESS_PORTAL=$(aws sso-admin get-application-assignment-configuration \
    --instance-arn $INSTANCE_ARN \
    --region us-east-1 2>/dev/null | jq -r '.Application.AssignmentConfiguration.DefaultApplicationArn' 2>/dev/null || echo "")

if [ -z "$ACCESS_PORTAL" ]; then
    ACCESS_PORTAL="https://${IDENTITY_STORE_ID}.awsapps.com/start"
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}SSO Setup Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Access Portal URL:"
echo -e "${YELLOW}$ACCESS_PORTAL${NC}"
echo ""
echo "Add this to ~/.aws/config:"
echo ""
cat << EOF
[profile sso-admin]
sso_start_url = $ACCESS_PORTAL
sso_region = us-east-1
sso_account_id = $ACCOUNT_ID
sso_role_name = $PERM_SET_NAME
region = eu-west-1
output = json
EOF

echo ""
echo "Then login with:"
echo -e "  ${YELLOW}aws sso login --profile sso-admin${NC}"
echo ""
