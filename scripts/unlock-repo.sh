#!/usr/bin/env bash
SCRIPT_NAME=$(basename ${0})

SECRET_NAME="gitcrypt"
KEY_NAME="$SECRET_NAME-gitcrypt.key"

echo "$SCRIPT_NAME: Unlocking repo with key $SECRET_NAME"
KEY_BASE64=$(aws secretsmanager get-secret-value --secret-id "$KEY_NAME" | jq -r '.SecretBinary')
echo "$KEY_BASE64" | base64 --decode > "$KEY_NAME"
git-crypt unlock "$KEY_NAME"
rm "$KEY_NAME"

echo "$SCRIPT_NAME: Done, repo unlocked and key removed"