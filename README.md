# Mohs Recon Ninja

A Vercel-ready Next.js/TypeScript MVP for case-based nasal Mohs reconstruction training.

## Current behavior

- Reads case content from `data/cases.json`.
- Publishes only cases whose `status` is `reviewed` or `final`.
- Supports one or multiple images per case.
- Keeps the image panel sticky on desktop.
- Asks subunit, structural-requirement, and preferred-reconstruction questions.
- Reveals grading and educational feedback only after Submit.
- Distinguishes a preferred reconstruction from acceptable alternatives.

## Run locally

```bash
npm install
npm run validate:cases
npm run dev
```

Open `http://localhost:3000`.

## Deploy through GitHub and Vercel

1. Create a new GitHub repository.
2. Copy this project into the repository.
3. Commit and push:

```bash
git init
git add .
git commit -m "Initial Mohs Recon Ninja MVP"
git branch -M main
git remote add origin YOUR_GITHUB_REPOSITORY_URL
git push -u origin main
```

4. In Vercel, choose **Add New Project**, import the GitHub repository, and deploy with the detected Next.js defaults.
5. Later pushes to `main` will trigger production deployments; other branches and pull requests receive preview deployments.

## Content workflow

The canonical Word guide remains the educational source of truth.

- `draft`: not exported/published
- `reviewed`: exported/published
- `final`: exported/published

The starter converter is:

```bash
python scripts/authoring-guide-to-json.py docs/JSONReadyGuide.docx data/generated-cases.json
```

It refuses to export a reviewed/final case containing `TBD`, rather than silently inventing missing content.

## Important source mismatch

The uploaded Word document still showed Cases 1–4 as `draft` and several rationale/difficulty fields as `TBD`. The four cases in this MVP were marked `reviewed` because the user explicitly said those four are ready. Cases 1, 2, and 4 retain clearly labeled pending-rationale text where the uploaded source did not provide final feedback.

## Automatic Word-to-JSON case import

`docs/JSONReadyGuide.docx` is the educational source of truth.

Running either command below automatically imports all cases whose status is `reviewed` or `final` before Next.js starts or builds:

```bash
npm run dev
npm run build
```

The importer:

- skips `draft` cases;
- rejects publishable cases with required missing or `TBD` fields;
- validates referenced files in `public/cases`;
- generates `data/cases.json` atomically;
- preserves the current JSON when every case in the guide is still a draft.

To run the import by itself:

```bash
npm run import-cases
```

After editing the guide, run `npm run dev`, review the app, and then commit and push both the guide and generated JSON.
