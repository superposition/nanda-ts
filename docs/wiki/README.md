# NANDA-TS Wiki

This directory contains the GitHub Wiki documentation for NANDA-TS.

## Publishing to GitHub Wiki

### Option 1: Using Git (Recommended)

GitHub wikis are separate git repositories. To publish:

```bash
# Clone the wiki repo (it's created automatically when you enable wiki on GitHub)
git clone https://github.com/YOUR-ORG/nanda-ts.wiki.git

# Copy the wiki files
cp docs/wiki/*.md nanda-ts.wiki/

# Commit and push
cd nanda-ts.wiki
git add .
git commit -m "Update wiki documentation"
git push
```

### Option 2: Manual Upload

1. Go to your repository on GitHub
2. Click the "Wiki" tab
3. Click "Create the first page" (or "New Page" for subsequent pages)
4. Copy content from each `.md` file

## Wiki Structure

| File | Description |
|------|-------------|
| `Home.md` | Main landing page |
| `Getting-Started.md` | Installation and quick start |
| `Architecture.md` | System design |
| `API-Reference.md` | Complete API docs |
| `Protocols.md` | Protocol details |
| `Registry.md` | Registry operations |
| `Agent-Identity.md` | DID and crypto |
| `Examples.md` | Code examples |
| `CLI.md` | CLI reference |
| `Contributing.md` | Contribution guide |
| `_Sidebar.md` | Wiki navigation sidebar |
| `_Footer.md` | Wiki footer |

## Keeping in Sync

Consider setting up a GitHub Action to automatically sync this directory to the wiki:

```yaml
# .github/workflows/wiki-sync.yml
name: Sync Wiki

on:
  push:
    paths:
      - 'docs/wiki/**'
    branches:
      - main

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Sync Wiki
        uses: Andrew-Chen-Wang/github-wiki-action@v4
        with:
          path: docs/wiki
          token: ${{ secrets.GITHUB_TOKEN }}
```

## Local Preview

To preview the wiki locally, you can use a markdown viewer or:

```bash
# Using grip (Python)
pip install grip
grip docs/wiki/Home.md

# Using markserv (Node.js)
npx markserv docs/wiki
```
