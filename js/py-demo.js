(function () {
  // 你可以在这里统一升级 Pyodide 版本
  const PYODIDE_BASE = "https://cdn.jsdelivr.net/pyodide/v0.29.2/full/";
  const PYODIDE_JS = PYODIDE_BASE + "pyodide.js";

  function injectPyodideScriptOnce() {
    if (window.__pyDemoPyodideScriptPromise) return window.__pyDemoPyodideScriptPromise;

    window.__pyDemoPyodideScriptPromise = new Promise((resolve, reject) => {
      if (window.loadPyodide) return resolve();

      const s = document.createElement("script");
      s.src = PYODIDE_JS;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("Failed to load pyodide.js"));
      document.head.appendChild(s);
    });

    return window.__pyDemoPyodideScriptPromise;
  }

  async function getPyodideOnce() {
    if (window.__pyDemoPyodide) return window.__pyDemoPyodide;
    if (window.__pyDemoPyodidePromise) return window.__pyDemoPyodidePromise;

    window.__pyDemoPyodidePromise = (async () => {
      await injectPyodideScriptOnce();
      const pyodide = await window.loadPyodide({ indexURL: PYODIDE_BASE });
      window.__pyDemoPyodide = pyodide;
      return pyodide;
    })();

    return window.__pyDemoPyodidePromise;
  }

  // -------------------------------
  // Code extraction & sanitation
  // -------------------------------

  // 读取 inline source（B 方案强保证）
  // 支持：
  // 1) <textarea class="py-demo__source" style="display:none;"> ... </textarea>
  // 2) <script type="text/plain" class="py-demo__source"> ... </script>
  function getInlineSource(root) {
    const ta = root.querySelector("textarea.py-demo__source");
    if (ta) return ta.value || ta.textContent || "";
    const scr = root.querySelector("script.py-demo__source");
    if (scr) return scr.textContent || "";
    return "";
  }

  // 把“高亮器用 CSS 换行”的 DOM，恢复成包含真实 \n 的源码字符串
  function extractCodeWithNewlines(node) {
    if (!node) return "";

    // 常见：每行一个 span.line（或 hljs-ln-line 等），DOM 里无 \n，需要手动 join
    const lineEls = node.querySelectorAll(
      "span.line, span.hljs-ln-line, div.line, div.hljs-ln-line"
    );
    if (lineEls && lineEls.length) {
      const lines = Array.from(lineEls).map(el => el.textContent);
      // 去掉某些主题在代码块末尾附加的语言标签（例如：PYTHON）
      // 只处理“最后一行完全等于该标签”的情况，避免误删正常代码
      while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
      if (lines.length && lines[lines.length - 1].trim().toUpperCase() === "PYTHON") {
        lines.pop();
      }
      return lines.join("\n");
    }

    // 处理 <br> 作为换行的情况
    const clone = node.cloneNode(true);
    clone.querySelectorAll("br").forEach(br => br.replaceWith("\n"));
    let s = clone.textContent || "";
    // 同样做一次兜底（极少数结构不走 lineEls 分支）
    s = s.replace(/\n[ \t]*PYTHON[ \t]*\n?$/i, "\n");
    return s;
  }

  // 统一净化：换行、NBSP、零宽字符、Tab 等
  function normalizePythonCode(raw) {
    if (!raw) return "";
    let s = String(raw);

    // 统一换行
    s = s.replace(/\r\n?/g, "\n");

    // NBSP -> 普通空格（否则 Python 可能 IndentationError）
    s = s.replace(/\u00A0/g, " ");

    // 去除零宽字符 / BOM
    s = s.replace(/[\u200B-\u200D\uFEFF]/g, "");

    // Tab 统一为 4 空格（避免 tab/space 混用）
    s = s.replace(/\t/g, "    ");

    // 去掉首尾多余空行
    s = s.replace(/^\s*\n+/, "").replace(/\n+\s*$/, "\n");

    return s;
  }

  // 去“公共缩进”，不破坏代码块内部相对缩进
  function dedent(s) {
    const lines = String(s || "").split("\n");
    let minIndent = null;

    for (const line of lines) {
      if (!line.trim()) continue;
      const m = line.match(/^ +/);
      const indent = m ? m[0].length : 0;
      minIndent = (minIndent === null) ? indent : Math.min(minIndent, indent);
      if (minIndent === 0) break;
    }

    if (!minIndent) return lines.join("\n");

    const pad = " ".repeat(minIndent);
    return lines.map(l => (l.startsWith(pad) ? l.slice(minIndent) : l)).join("\n");
  }

  // 从“容器前一个代码块”提取 Python 源码（兼容 Hexo 常见高亮结构）
  function findPrevCodeText(root) {
    let el = root.previousElementSibling;
    while (el) {
      // 1) Hexo highlight：figure.highlight > table > td.code > pre
      if (el.matches && el.matches("figure.highlight")) {
        const pre = el.querySelector("td.code pre");
        const code = extractCodeWithNewlines(pre);
        if (code && code.trim()) return code;
      }

      // 2) 普通 Markdown fenced：<pre><code>...</code></pre>
      const preCode = el.querySelector && el.querySelector("pre code");
      if (preCode) {
        const code = extractCodeWithNewlines(preCode);
        if (code && code.trim()) return code;
      }

      // 3) 兜底：直接 pre
      if (el.matches && el.matches("pre")) {
        const code = extractCodeWithNewlines(el);
        if (code && code.trim()) return code;
      }

      el = el.previousElementSibling;
    }
    return "";
  }

  // -------------------------------
  // UI
  // -------------------------------

  function buildUI(root, defaultCode, defaultArgv) {
    root.innerHTML = `
      <div class="py-demo__grid">
        <div class="py-demo__card">
          <div class="py-demo__hint">
            说明：点击运行后才会加载 Pyodide。首次加载会下载运行时，之后通常会被浏览器缓存。
          </div>
        </div>

        <div class="py-demo__card">
          <label class="py-demo__label">Python 代码（可编辑）</label>
          <textarea class="py-demo__code"></textarea>
        </div>

        <div class="py-demo__card">
          <label class="py-demo__label">模拟命令行参数（相当于：python hello.py ...）</label>
          <input class="py-demo__argv" placeholder="例如：Alice 或：--help" />
          <div class="py-demo__bar">
            <button class="py-demo__run">运行</button>
            <span class="py-demo__status py-demo__hint"></span>
          </div>
        </div>

        <div class="py-demo__card">
          <label class="py-demo__label">输出</label>
          <pre class="py-demo__out"></pre>
        </div>
      </div>
    `;

    const codeEl = root.querySelector(".py-demo__code");
    const argvEl = root.querySelector(".py-demo__argv");
    codeEl.value = defaultCode || "";
    argvEl.value = defaultArgv || "";
  }

  // 用 Python 内部 redirect_stdout/redirect_stderr 捕获输出，避免 pyodide.setStdout 的全局干扰
  async function runCode({ code, argv, statusEl }) {
    statusEl.textContent = "正在加载 Pyodide…（首次可能较慢）";

    const pyodide = await getPyodideOnce();

    // 可选：根据 imports 自动加载 Pyodide 自带包（对纯 stdlib 一般不需要）
    try {
      statusEl.textContent = "解析依赖并准备运行…";
      await pyodide.loadPackagesFromImports(code);
    } catch (_) {
      // 忽略：用户代码可能 import 了 Pyodide 不提供的包
    }

    statusEl.textContent = "运行中…";

    const runner =
`import sys, shlex, traceback, io, contextlib
argv_str = ${JSON.stringify(argv || "")}
sys.argv = ["hello.py"] + shlex.split(argv_str)

_code = ${JSON.stringify(code || "")}

_stdout = io.StringIO()
_stderr = io.StringIO()

try:
    with contextlib.redirect_stdout(_stdout), contextlib.redirect_stderr(_stderr):
        exec(_code, {"__name__": "__main__"})
except SystemExit:
    # argparse 的 --help / 参数错误通常会触发 SystemExit
    pass
except Exception:
    traceback.print_exc(file=_stderr)

_out = _stdout.getvalue()
_err = _stderr.getvalue()
_result = _out + (("\\n" if _out and _err else "") + _err)
_result
`;
    const out = await pyodide.runPythonAsync(runner);
    statusEl.textContent = "完成。";
    return String(out ?? "");
  }

  // -------------------------------
  // Init
  // -------------------------------

  function initOne(root) {
    if (root.dataset.pyDemoInited === "1") return;
    root.dataset.pyDemoInited = "1";

    const from = root.dataset.from || "prev";     // prev | inline
    const defaultArgv = root.dataset.argv || "";

    // 关键：先取源码（因为 buildUI 会覆盖 root.innerHTML）
    let defaultCode = "";
    if (from === "inline") {
      defaultCode = getInlineSource(root);
    } else {
      defaultCode = findPrevCodeText(root);
    }

    defaultCode = dedent(normalizePythonCode(defaultCode));

    buildUI(root, defaultCode, defaultArgv);

    const outEl = root.querySelector(".py-demo__out");
    const statusEl = root.querySelector(".py-demo__status");
    const runBtn = root.querySelector(".py-demo__run");
    const codeEl = root.querySelector(".py-demo__code");
    const argvEl = root.querySelector(".py-demo__argv");

    if (!defaultCode.trim()) {
      statusEl.textContent = (from === "inline")
        ? "未找到容器内的源码（.py-demo__source）。"
        : "未找到上一段代码块，请确认容器紧跟在 Python 代码块后面。";
    }

    // 简单串行队列，避免同一页多次并发运行造成体验问题
    if (!window.__pyDemoQueue) window.__pyDemoQueue = Promise.resolve();

    runBtn.addEventListener("click", () => {
      outEl.textContent = "";
      runBtn.disabled = true;

      window.__pyDemoQueue = window.__pyDemoQueue.then(async () => {
        try {
          const output = await runCode({
            code: codeEl.value,
            argv: argvEl.value,
            statusEl
          });
          outEl.textContent = output;
        } catch (e) {
          outEl.textContent = "[JS Error]\n" + (e && e.stack ? e.stack : String(e));
          statusEl.textContent = "运行失败。";
        } finally {
          runBtn.disabled = false;
        }
      });
    });
  }

  function initAll() {
    document.querySelectorAll("[data-py-demo]").forEach(initOne);
  }

  // 首次加载
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAll);
  } else {
    initAll();
  }

  // 兼容 Fluid PJAX：页面局部刷新后重新扫描并初始化
  document.addEventListener("pjax:complete", initAll);
})();
