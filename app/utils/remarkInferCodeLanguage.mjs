export default function remarkInferCodeLanguage() {
  return (tree) => {
    walk(tree)
  }
}

function walk(node) {
  if (node.type === 'code' && !node.lang && typeof node.value === 'string') {
    const language = inferCodeLanguage(node.value)
    if (language) {
      node.lang = language
    }
  }

  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      walk(child)
    }
  }
}

function inferCodeLanguage(value) {
  const code = value.trim()

  if (!code) {
    return undefined
  }

  if (isJson(code)) {
    return 'json'
  }

  if (looksLikeYaml(code)) {
    return 'yaml'
  }

  if (looksLikeVue(code)) {
    return 'vue'
  }

  if (looksLikeHtml(code)) {
    return 'html'
  }

  if (looksLikePython(code)) {
    return 'python'
  }

  if (looksLikeShell(code)) {
    return 'bash'
  }

  if (looksLikeSql(code)) {
    return 'sql'
  }

  if (looksLikeCss(code)) {
    return 'css'
  }

  if (looksLikeTypeScript(code)) {
    return 'typescript'
  }

  if (looksLikeJavaScript(code)) {
    return 'javascript'
  }

  return undefined
}

function isJson(code) {
  if (!/^[{[]/.test(code)) {
    return false
  }

  try {
    JSON.parse(code)
    return true
  } catch {
    return false
  }
}

function looksLikeYaml(code) {
  return /^---\s*$/m.test(code)
    || /^(apiVersion|kind|metadata|spec|services|name|version):\s*\S?/m.test(code)
    || /^-\s+[\w-]+:\s+\S+/m.test(code)
}

function looksLikeVue(code) {
  return /<(template|script|style)(\s|>)/i.test(code)
}

function looksLikeHtml(code) {
  return /^<\/?[a-z][\w:-]*(\s|>)/i.test(code)
}

function looksLikePython(code) {
  return /^(from\s+\S+\s+import\s+\S+|import\s+\S+|def\s+\w+\(|class\s+\w+|print\()/m.test(code)
    || /^\s{4,}(if|for|while|return|yield|with)\b/m.test(code)
}

function looksLikeShell(code) {
  return /^[$#]\s+/m.test(code)
    || /^(sudo|curl|wget|git|pnpm|npm|yarn|npx|node|python|pip|uv|docker|kubectl|helm|wrangler|cd|mkdir|cp|mv|rm|cat|echo|export|source|ssh)\b/m.test(code)
}

function looksLikeSql(code) {
  return /^(select|insert|update|delete|create|alter|drop)\s+/im.test(code)
}

function looksLikeCss(code) {
  return /^[.#]?[\w-]+[\w\s.,:#()[\]="'-]*\{\s*$/m.test(code)
    || /^\s*[\w-]+:\s*[^;]+;\s*$/m.test(code)
}

function looksLikeTypeScript(code) {
  return /\b(type|interface|enum)\s+\w+/m.test(code)
    || /:\s*(string|number|boolean|unknown|Record<|Promise<)[,)=]/m.test(code)
}

function looksLikeJavaScript(code) {
  return /\b(import|export)\s+.+\bfrom\b/m.test(code)
    || /\b(const|let|var|function|async function)\s+\w+/m.test(code)
    || /(=>|console\.\w+\()/m.test(code)
}
