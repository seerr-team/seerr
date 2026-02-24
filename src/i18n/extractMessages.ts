import { promises as fs } from 'fs';
import { join } from 'path';

// get all file content recursively
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

// extract the i18n messages from the file
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
  // get messages from all files and sort them by namespace
  const files = await getFiles(dir);
  const extractedMessagesGroups = await Promise.all(files.map(extractMessages));

  // group messages by namespace
  const messagesByNamespace: {
    namespace: string;
    messages: Record<string, string>;
  }[] = [];
  const namespaces = [
    ...new Set(extractedMessagesGroups.map((msg) => msg?.namespace)),
  ];
  for (const namespace of namespaces) {
    if (!namespace) continue;
    const filteredMessagesGroups = extractedMessagesGroups
      .filter((msg) => msg?.namespace === namespace)
      .map((msg) => msg?.messages);
    for (const extractedMessages of filteredMessagesGroups) {
      if (!extractedMessages) continue;
      const previousNamespaceMessages = messagesByNamespace.find(
        (msg) => msg.namespace === namespace
      );
      if (previousNamespaceMessages) {
        Object.assign(previousNamespaceMessages.messages, extractedMessages);
      } else {
        messagesByNamespace.push({ namespace, messages: extractedMessages });
      }
    }
  }

  messagesByNamespace.sort((a, b) => {
    if (!a || !b) return 0;
    if (
      a.namespace.startsWith(b.namespace) ||
      b.namespace.startsWith(a.namespace)
    ) {
      const aLevel = a.namespace.match(/\./g)?.length || 0;
      const bLevel = b.namespace.match(/\./g)?.length || 0;
      return bLevel - aLevel;
    }
    return a.namespace.localeCompare(b.namespace);
  });

  // add every messages from every namespace to an object
  const result: Record<string, string> = {};
  for (const extractedMessages of messagesByNamespace) {
    const { namespace, messages } = extractedMessages;
    for (const key of Object.keys(messages).sort()) {
      result[`${namespace}.${key}`] = messages[key];
    }
  }

  return JSON.stringify(result, null, '  ') + '\n';
}

async function saveMessages() {
  const directoryPath = './src/';
  const resultPath = './src/i18n/locale/en.json';

  const result = await processMessages(directoryPath);
  await fs.writeFile(resultPath, result);
}

saveMessages();

export {};
