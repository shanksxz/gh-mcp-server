#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { Octokit } from "@octokit/rest";

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const octokit = new Octokit(GITHUB_TOKEN ? { auth: GITHUB_TOKEN } : {});

if (GITHUB_TOKEN) {
  console.error("GitHub API: Using authentication token");
} else {
  console.error("GitHub API: No authentication token provided. Rate limits will be restricted to 60 requests/hour.");
  console.error("Set the GITHUB_TOKEN environment variable to increase this limit to 5000 requests/hour.");
}

async function getRepoContents(owner: string, repo: string, path: string = ""): Promise<any[]> {
  try {
    const response = await octokit.repos.getContent({
      owner,
      repo,
      path,
    });

    if (Array.isArray(response.data)) {
      return response.data;
    } else if (response.data && 'type' in response.data) {
      return [response.data];
    }

    return [];
  } catch (error) {
    console.error(`Error getting repo contents for ${owner}/${repo}/${path}:`, error);
    return [];
  }
}

async function getFileContent(owner: string, repo: string, path: string): Promise<string | null> {
  try {
    const response = await octokit.repos.getContent({
      owner,
      repo,
      path,
    });

    if ('content' in response.data && 'encoding' in response.data) {
      if (response.data.encoding === 'base64') {
        return Buffer.from(response.data.content, 'base64').toString('utf-8');
      }
    }

    return null;
  } catch (error) {
    console.error(`Error getting file content for ${owner}/${repo}/${path}:`, error);
    return null;
  }
}

async function getAllFiles(owner: string, repo: string, path: string = ""): Promise<{ path: string, type: string }[]> {
  const contents = await getRepoContents(owner, repo, path);
  let allFiles: { path: string, type: string }[] = [];

  for (const item of contents) {
    if (item.type === 'file') {
      allFiles.push({
        path: item.path,
        type: 'file'
      });
    } else if (item.type === 'dir') {
      const subFiles = await getAllFiles(owner, repo, item.path);
      allFiles = [...allFiles, ...subFiles];
    }
  }

  return allFiles;
}

const server = new McpServer({
  name: "github-repo-context",
  version: "1.0.0",
});

server.tool(
  "get-repo-context",
  "Get all files from a GitHub repository to use as context",
  {
    owner: z.string().describe("GitHub repository owner/organization name"),
    repo: z.string().describe("GitHub repository name"),
    maxFiles: z.number().optional().describe("Maximum number of files to include (default: 50)"),
    fileExtensions: z.array(z.string()).optional().describe("File extensions to include (e.g., ['js', 'ts', 'md'])"),
    excludePaths: z.array(z.string()).optional().describe("Paths to exclude (e.g., ['node_modules', 'dist'])"),
  },
  async ({ owner, repo, maxFiles = 50, fileExtensions = [], excludePaths = ['node_modules', 'dist', 'build'] }) => {
    try {
      console.error(`Fetching files from ${owner}/${repo}...`);

      const allFiles = await getAllFiles(owner, repo);
      console.error(`Found ${allFiles.length} total files in the repository`);

      let filteredFiles = allFiles.filter(file => {
        if (excludePaths.some(excludePath => file.path.includes(excludePath))) {
          return false;
        }

        if (fileExtensions.length > 0) {
          const extension = file.path.split('.').pop() || '';
          return fileExtensions.includes(extension);
        }

        return true;
      });

      filteredFiles = filteredFiles.slice(0, maxFiles);
      console.error(`Selected ${filteredFiles.length} files after filtering`);

      const fileContents: { path: string; content: string | null }[] = [];
      for (const file of filteredFiles) {
        if (file.type === 'file') {
          const content = await getFileContent(owner, repo, file.path);
          fileContents.push({
            path: file.path,
            content
          });
        }
      }

      const formattedContent = fileContents
        .filter(file => file.content !== null)
        .map(file => `File: ${file.path}\n\n\`\`\`\n${file.content}\n\`\`\`\n\n`)
        .join('---\n\n');

      return {
        content: [
          {
            type: "text",
            text: `Repository Context for ${owner}/${repo}:\n\n${formattedContent}`,
          },
        ],
      };
    } catch (error) {
      console.error("Error fetching repository context:", error);
      return {
        content: [
          {
            type: "text",
            text: `Error fetching repository context: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  },
);

server.tool(
  "get-file-content",
  "Get content of a specific file from a GitHub repository",
  {
    owner: z.string().describe("GitHub repository owner/organization name"),
    repo: z.string().describe("GitHub repository name"),
    path: z.string().describe("Path to the file in the repository"),
  },
  async ({ owner, repo, path }) => {
    try {
      const content = await getFileContent(owner, repo, path);

      if (!content) {
        return {
          content: [
            {
              type: "text",
              text: `Could not retrieve content for ${path} in ${owner}/${repo}`,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text",
            text: `File: ${path}\n\n\`\`\`\n${content}\n\`\`\``,
          },
        ],
      };
    } catch (error) {
      console.error(`Error fetching file content for ${path}:`, error);
      return {
        content: [
          {
            type: "text",
            text: `Error fetching file content: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  },
);

server.tool(
  "get-repo-structure",
  "Get the structure of a GitHub repository",
  {
    owner: z.string().describe("GitHub repository owner/organization name"),
    repo: z.string().describe("GitHub repository name"),
  },
  async ({ owner, repo }) => {
    try {
      const allFiles = await getAllFiles(owner, repo);

      const fileStructure = allFiles
        .map(file => file.path)
        .sort()
        .join('\n');

      return {
        content: [
          {
            type: "text",
            text: `Repository Structure for ${owner}/${repo}:\n\n${fileStructure}`,
          },
        ],
      };
    } catch (error) {
      console.error("Error fetching repository structure:", error);
      return {
        content: [
          {
            type: "text",
            text: `Error fetching repository structure: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("GitHub Repository Context MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
