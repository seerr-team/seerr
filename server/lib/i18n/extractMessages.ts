import { promises as fs } from 'fs';
import { join } from 'path';

async function getFiles(dir: string): Promise<string[]> {
  const dirents = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    dirents.map((dirent) => {
      const res = join(dir, dirent.name);
      return dirent.isDirectory() ? getFiles(res) : res;
    })
  );
  return Array.prototype.concat(...files);
}

async function extractMessages(
  filePath: string
): Promise<{ namespace: string; messages: Record<string, string> } | null> {
  const content = await fs.readFile(filePath, 'utf8');
  const regex = /defineMessages\(\n?\s*'(.+?)',\n?\s*\{([\s\S]+?)\}\n?\);/;
  const match = content.match(regex);
  if (match) {
    const [, namespace, messages] = match;
    try {
      const formattedMessages = messages
        .trim()
        .replace(/^\s*(['"])?([a-zA-Z0-9_-]+)(['"])?:[\s\n]*/gm, '"$2":')
        .replace(/^"[a-zA-Z0-9_-]+":'.*',?$/gm, (match) => {
          const parts = /^("[a-zA-Z0-9_-]+":)'(.*)',?$/.exec(match);
          if (!parts) return match;
          return `${parts[1]}"${parts[2]
            .replace(/\\/g, '\\\\')
            .replace(/"/g, '\\"')}",`;
        })
        .replace(/,$/, '');
      const messagesJson = JSON.parse(`{${formattedMessages}}`);
      return { namespace: namespace.trim(), messages: messagesJson };
    } catch {
      return null;
    }
  }
  return null;
}

async function processMessages(dir: string): Promise<string> {
  const files = await getFiles(dir);
  const tsFiles = files.filter((f) => /\.tsx?$/.test(f));
  const extractedMessagesGroups = await Promise.all(
    tsFiles.map(extractMessages)
  );

  const result: Record<string, string> = {};

  for (const group of extractedMessagesGroups) {
    if (!group) continue;
    for (const key of Object.keys(group.messages).sort()) {
      result[`${group.namespace}.${key}`] = group.messages[key];
    }
  }

  return JSON.stringify(result, Object.keys(result).sort(), '  ') + '\n';
}

async function saveMessages() {
  const directoryPath = './server/';
  const resultPath = './server/lib/i18n/locale/en.json';

  const result = await processMessages(directoryPath);
  await fs.writeFile(resultPath, result);
}

saveMessages();

export {};
