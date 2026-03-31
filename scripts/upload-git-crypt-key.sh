#!/usr/bin/env bash
SCRIPT_NAME=$(basename ${0})
OPTIONS="--name | -n (Name of the secret in AWS Secretsmanager), --file | -n (Path to git-crypt key file), --overwrite | -r (Overwrite any existing secret with the same name)"
OVERWRITE="false"
while [ $# -gt 0 ]; do
    case "$1" in
    "--name" | "-n")
      shift
      SECRET_NAME=$1
      ;;
    "--file" | "-f")
      shift
      KEY_FILE=$1
      ;;
    "--overwrite" | "-w")
      shift
      OVERWRITE="true"
      ;;
    *)
      echo "${bR}$SCRIPT_NAME: Unknown option [$1]. Options: $OPTIONS${cZ}"
      exit 1
      ;;
    esac
    shift
done

if [ -z "$SECRET_NAME" ]; then
  echo "Missing secret name. Options: $OPTIONS"
  exit 1
fi
if ! [ -e "$KEY_FILE" ]; then
  echo "Missing git-crypt file. Options: $OPTIONS"
  exit 1
fi

EXISTS=$(aws secretsmanager list-secrets | jq -r '.SecretList[] | select( .Name == "'"$SECRET_NAME"'" ) | .Name')
if [ -n "$EXISTS" ]; then
  if [  "$OVERWRITE" == "true" ]; then
    echo "$SCRIPT_NAME: Updating secret $SECRET_NAME"
    aws secretsmanager put-secret-value --secret-id "$SECRET_NAME" --secret-binary "fileb://$KEY_FILE"
  else
    echo "$SCRIPT_NAME: ${bY}A secret with the same name already exists, use flag --overwrite to update the secret${cZ}"
  fi
else
  echo "$SCRIPT_NAME: Creating secret $SECRET_NAME"
  aws secretsmanager create-secret --name "$SECRET_NAME" --secret-binary "fileb://$KEY_FILE"
fi

echo "$SCRIPT_NAME: Done"
