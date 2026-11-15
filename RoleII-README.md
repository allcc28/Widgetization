## Local LLM integration (Role II)

The Vite development server exposes `POST /api/generate`. It calls Ollama at `http://127.0.0.1:11434/api/chat` using `qwen2.5:0.5b` and a JSON schema. Each developer downloads the model locally. No API key is required. The following commands are for Windows PowerShell.

### Reproduce the demo

1. Clone the team repository, check out the commit you want to reproduce, and open PowerShell in the directory containing `package-lock.json`. Install Node.js with npm (use a Node version supported by the locked Vite release) and [Ollama](https://ollama.com/download/windows).
2. Install the locked JavaScript dependencies:

   ```powershell
   npm.cmd ci
   ```

3. Start Ollama. If the desktop app is already serving requests, use that instance. Otherwise run `ollama serve` in a separate terminal. To use another drive, set `OLLAMA_MODELS` to a writable directory before starting the server. Restart the desktop app if its environment has changed.
4. Download the model and verify that the tag is installed:

   ```powershell
   ollama pull qwen2.5:0.5b
   ollama list
   ```

5. Start the project and open the local URL printed by Vite:

   ```powershell
   npm.cmd run typecheck
   npm.cmd run dev
   ```

   Use `/?condition=bounded` or `/?condition=baseline`. Change a parameter, preview its scope, click **Apply**, and click **Undo** to restore the previous state. **Finish task** ends the session and locks the controls. The demo starts from a fixed sample party. Initial generation is exercised separately by the acceptance test. The generation endpoint runs in the Vite development server; serving only the static build does not provide that endpoint.

### Verify the integration

Keep Ollama running and open another PowerShell in the repository root:

```powershell
$env:VITE_RUN_OLLAMA_TEST = "1"
npm.cmd test -- tests/ollamaClient.live.test.ts tests/heroSwap.live.test.ts tests/roleII.acceptance.test.ts
```

The three files define nine tests. Five call the local model: two power edits, two hero swaps, and one initial party generation. Four simulate invalid JSON, retry recovery, timeouts, and HTTP failures. Check for skipped tests if fewer than nine execute. Run `npm.cmd test` for the complete project suite.

Bounded output for an edit contains the edited card and overview. Baseline output contains all four nodes. Record returned IDs and changed fields separately: returning a node does not imply its content changed. Generated prose and latency can vary. A schema-valid result may still contain weak character descriptions or abilities.

### Record a reproducible run

Capture the Git commit, runtime versions, model ID, machine/GPU, and test output alongside the result:

```powershell
git rev-parse HEAD
node --version
npm.cmd --version
ollama --version
ollama list
ollama show qwen2.5:0.5b
```

Use the same model ID, client settings, starting party, and edit when comparing conditions. A tag alone does not identify the exact model build indefinitely. For a team reproduction record, save the model ID and version outputs from the actual run. Keep local model weights, dependency directories, and participant logs out of Git.
