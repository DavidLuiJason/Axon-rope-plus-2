# AXON G5a — two-registry architecture verdict (read-only audit)

**Verdict: keep both registries, with a strict boundary (option ii).** Do not merge or retire either in Phase G. The two layers are live, different and tested; merging them now would create risk without a measured benefit. This is a proposed architectural decision, pending owner approval.

## Import/registration graph (measured from this project)

```text
src/main.tsx
  ├── capabilities/register{Settings,AxonTools,AxonSource,InterfaceCapture,BackgroundProof}
  │     └── capabilities/registry.ts → capabilities/types.ts
  └── interfaces/register{Settings,AxonTools,AxonSource,InterfaceCapture,BackgroundProof}
        └── interfaces/registry.ts → interfaces/types.ts

src/components/AxonBuildScreen.tsx
  ├── capabilities/registry.ts → listCapabilities()
  └── interfaces/registry.ts → listInterfaces()

tests/tools.test.ts
  ├── capability registration, lookup and duplicate rejection
  └── interface registration, lookup and parent/child tests
```

**Capability** is the nonvisual unit of ability: stable id, contract/implementation versions, declared permissions and resource needs. **Interface** is a visible surface: stable id, screen/panel/drawer/modal/overlay kind, parent and navigability. One capability may have no screen; one screen may expose several capabilities. Neither registry grants permissions or instantiates an implementation: both currently hold metadata only. Keep registration explicit, not tied to React mounting.

## Planned later work (not implemented in G5a)

1. At N4, add the knowledge slot as a capability with its own stable contract. It must not need an interface to function.
2. At N5, add a Dictionary interface only if the owner approves the screen; reference the knowledge capability by stable id, not by copying implementation into the interface registry.
3. Before Phase R tools, define a small mapping/validation function for capabilities with user-facing interfaces; keep the registries separate. Add tests for missing capability IDs, duplicate registration and non-navigable surfaces.
4. At G5b, audit whether declared permissions become enforced at runtime; they are **advisory only today** and must never be represented as a security barrier.

**Risk/cost:** Two small metadata registries require two registration calls for a feature with a screen, but avoid coupling future headless tools, background jobs and dictionaries to UI navigation. No runtime measurements or owner sign-off yet.
