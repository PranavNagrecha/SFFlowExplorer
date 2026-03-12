# GitHub repository setup (SFFlowExplorer)

Use this checklist to add **description**, **topics**, and related settings to your GitHub repo.

---

## 1. Set repo description and About section

On GitHub, open your repo and click the **gear icon** next to "About" (top right of the README):

- **Description** (short summary, shown in search and repo header):
  ```
  Converts Salesforce Flow metadata XML (.flow-meta.xml) into Draw.io diagrams. Local CLI, no org connection required.
  ```
- **Website** (optional): leave blank or add a docs link.
- **Topics** (tags): add these so the repo is discoverable:

  ```
  salesforce
  flow
  drawio
  diagrams
  metadata
  cli
  visualization
  devtools
  ```

You can add or remove topics; the above match the project’s `keywords` in `package.json`.

---

## 2. Rename the parent folder (optional)

If your project folder is still named **Flow to Lucid**, rename it to **SFFlowExplorer** so it matches the repo:

1. Close this project in VS Code/Cursor (so nothing is using the folder).
2. In Terminal, from the parent directory:
   ```bash
   cd "/Users/user/VS Code/Personal"
   mv "Flow to Lucid" "SFFlowExplorer"
   ```
3. Reopen the project: **File → Open Folder** → choose `SFFlowExplorer`.

Git and remotes are unchanged; only the folder name on disk changes.

---

## 3. Optional: set up with GitHub CLI

If you install [GitHub CLI](https://cli.github.com/) (`brew install gh` on macOS), you can set description and topics from the command line:

```bash
cd "/Users/user/VS Code/Personal/SFFlowExplorer"   # or "Flow to Lucid" if not renamed yet
gh repo edit --description "Converts Salesforce Flow metadata XML (.flow-meta.xml) into Draw.io diagrams. Local CLI, no org connection required."
gh repo edit --add-topic salesforce --add-topic flow --add-topic drawio --add-topic diagrams --add-topic metadata --add-topic cli --add-topic visualization --add-topic devtools
```

---

## 4. Push the latest changes

After the renames and doc updates in this repo, push to GitHub:

```bash
git add -A
git status
git commit -m "Rename project to SFFlowExplorer; add GitHub setup doc"
git push
```

Then complete the About/topics steps above on the GitHub website (or via `gh repo edit` if you use GitHub CLI).
