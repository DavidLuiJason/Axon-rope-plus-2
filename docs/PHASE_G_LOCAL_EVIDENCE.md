# AXON Phase G — implementation evidence, 2026-10-12

## Foundation Check (Part 1) and Top-View Check (Part 00)

- **Layer:** G1b/G1c/A/G2 are Layer 0 transport/build/signing; G3 is Layer 1 knowledge storage; G5a decides the future capability/UI boundary. Above them will sit the knowledge slot, language reader, truth checking, personality, tools and media.
- **Measured carriers:** supplied source ZIP: 3,471 files, 3,346 dictionary files; source snapshot generated after initial edits: Z1 128 files/747,214 bytes, Z2 3,346 files/66,615,632 bytes. A full npm/Android build was not available locally (npm registry DNS EAI_AGAIN; local Node 22, cloud uses Node 20). Do not substitute these local numbers for cloud or phone capacity.
- **One job/one proof:** G2 snapshot generator has an independent 11-check fixture test and exact source comparison. Auto-unpack has five real-tree local simulation scenarios. G3 packing has byte-for-byte verification of every shard and three legal files. G1b and G1c need cloud/device proof. G5a is a read-only verdict pending owner approval.
- **Cheap failures tested:** deleted/changed dictionary shard; changed source byte; secret-file exclusion; binary source; path traversal; altered workflow; incomplete project upload; corrupted dictionary upload.
- **Future growth:** Z1 budget is 600 files / 25 MiB (fails build when exceeded). Z2 files are listed dynamically by zone and per-language form; future languages automatically enter the manifest. The guard ratchets new source files and checks dictionary manifests. Generated source snapshots are excluded from source to prevent recursion.
- **Repetition removed locally:** snapshot generation before every build, deterministic source ZIP, source-file comparison, automatic unpack candidate, Android release publishing, Node/npm/memory reporting, stable-signing secret support. Their GitHub operation is not yet proven.
- **Two-strike rule:** no third attempt was made on a twice-failed stage; no evidence of a new two-strike situation. Changes remain Phase G only.
- **Applicable rules:** Rules 1–13, especially 1/2/3/4/6/7/8/9/10/11/12/13, and FL1–FL9. Dictionary remains core and licences unchanged. Any further G2/G3 changes must be measured and reviewed against this entire map.

## Status by stage

| Stage | State | Evidence / missing proof |
|---|---|---|
| G1/G1x | G1 builder-reported complete; G1x line already in supplied ZIP | Build result is from earlier Grok report, not rerun here |
| A/G6 | Scripts/workflows prepared | 5 local simulations pass; real A4 GitHub automatic run **not run** |
| G1b | Workflow prepared | npm ci / lockfile creation and two identical cloud builds **not run** |
| G1c | Secret-based stable debug key generated separately | Real two-APK update-in-place with retained user data **not run** |
| G2 | Snapshot, viewer/export path, manifest, compare, CI checks implemented | 11 fixture checks + real-tree snapshot checks pass; AI Studio preview and installed APK exports **not run** |
| G3 | Candidate packer, verifier and reader prototype | 58 packs, 65 files, 16,654,080 bytes; all 3,340 shard bytes equal; candidate **not installed** |
| G4 | Not started | E2/E3/E1 push experiments need the owner's throwaway GitHub/AI Studio projects |
| G5a | Read-only verdict written | Keep both registries with a strict boundary; owner approval pending |
| G5b/G7 | Not started | Foundation audit, phone checks, gate, restore point and sign-off remain |

## Security and fidelity

The app's complete export now reads the same manifest on preview and phone; Z1 is a binary-safe archive and Z2 is fetched from the installed app assets and hash-verified, **never omitted**. An explicit source-only option is labelled incomplete. The snapshot excludes secrets and generated folders, but includes dot files, workflow files, legal notices and `package-lock.json` when present. The private signing key is **not** in the source ZIP; configure GitHub secret `AXON_DEBUG_KEYSTORE_B64` to avoid ephemeral signing.

The owner must manually paste workflow files in GitHub because an automatic token cannot update them. Existing repository protection files (`tools/guard.mjs`, `tools/files.lock`, `tools/auto-unpack.sh`) also require an intentional manual update if changed. Cloud builds are not proof of Android functionality until the owner tests the APK on a phone.
