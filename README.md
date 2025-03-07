# GitHub Repository MCP Server

This Model Context Protocol (MCP) server allows AI models to access GitHub repository contents as context. It provides tools to fetch file contents, repository structure, and entire repositories for use as context in AI interactions.

## Features

- Fetch entire repository contents as context
- Get specific file contents from a repository
- Get repository structure (file listing)
- Filter files by extension
- Exclude specific paths
- Limit the number of files returned

## Installation

```bash
# clone the repository
git clone https://github.com/shanksxz/github-mcp.git
cd github-mcp

# install dependencies
npm install

# build the project
npm run build
```

## Usage

### Setting up GitHub Authentication

While the server can work with public repositories without authentication, GitHub API has strict rate limits for unauthenticated requests (60 requests/hour). To increase this limit to 5000 requests/hour, set the `GITHUB_TOKEN` environment variable:

```bash
# create a file called gh.sh and add the following line:
export GITHUB_TOKEN=your_github_personal_access_token
# make the file executable
chmod +x gh.sh
# run the file
./gh.sh
```

You can create a personal access token in your [GitHub Developer Settings](https://github.com/settings/tokens).

### Using with Cursor

To use this server with Cursor follow these steps:
1. Open Cursor Settings
2. Search for "MCP"
3. Click on "Add a new MCP Server"
4. Enter the following information:
    - Name: github-repo-context (or any name you want)
    - Type: Command
    - Command: /path/to/your-local-repo-setup/gh.sh
5. Click "Save"
6. Enable the server by clicking the toggle next to the server name
7. You should now be able to use the server in your project



The server communicates via stdin/stdout following the MCP protocol.

### Available Tools

The server provides the following tools:

1. **get-repo-context**: Get all files from a GitHub repository to use as context
   - Parameters:
     - `owner`: GitHub repository owner/organization name
     - `repo`: GitHub repository name
     - `maxFiles` (optional): Maximum number of files to include (default: 50)
     - `fileExtensions` (optional): File extensions to include (e.g., ['js', 'ts', 'md'])
     - `excludePaths` (optional): Paths to exclude (default: ['node_modules', 'dist', 'build'])

2. **get-file-content**: Get content of a specific file from a GitHub repository
   - Parameters:
     - `owner`: GitHub repository owner/organization name
     - `repo`: GitHub repository name
     - `path`: Path to the file in the repository

3. **get-repo-structure**: Get the structure of a GitHub repository
   - Parameters:
     - `owner`: GitHub repository owner/organization name
     - `repo`: GitHub repository name

## Example

When integrated with an AI model that supports MCP, you can use commands like:

```
Get the structure of the repository tensorflow/tensorflow
```

The AI would then use the `get-repo-structure` tool to fetch and display the repository structure.
