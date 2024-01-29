import { readFileSync } from "fs";
import { syncGithubRepo } from "./ci-actions/github";
import { join } from "path";

void syncGithubRepo({
    githubToken: readFileSync(join('tmp', 'token')).toString(),
    repoPath: 'HanseltimeIndustries/test-private-template',
    templateBranch: 'main',
})