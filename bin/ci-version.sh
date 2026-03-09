#!/bin/bash -e

##################################################################################
#
# This is a bundled script for calling versioning in pre or non-prelease context
# of a github action.
#
# This is because the auto changset action can't handle very complext commands as
# arguments.
#
##################################################################################


if [ "$BRANCH_NAME" == "master" ]; then
echo 'precommand=if [ -f .changeset/pre.json ]; then yarn changeset pre exit; fi' >> $GITHUB_OUTPUT
    if [ -f .changeset/pre.json ]; then
        yarn changeset pre exit;
    fi
elif [ "$BRANCH_NAME" == "alpha" ]; then
    yarn changeset pre enter alpha
else
    echo "Unknown branch name for versioning! $BRANCH_NAME"
    exit 1
fi

yarn changeset version

# apply biome format for changed files
yarn biome format --fix