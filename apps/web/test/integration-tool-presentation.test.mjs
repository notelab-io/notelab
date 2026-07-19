export function register({ assert, loadModule, test }) {
  test("uses Toolkit metadata for integration tool presentation", async () => {
    const { resolveIntegrationToolPresentation } = await loadModule(
      "/src/components/ai-elements/integration-tool-presentation.ts",
    );

    assert.deepEqual(
      resolveIntegrationToolPresentation({
        legacySource: "slack",
        legacyTitle: "Legacy title",
        part: {
          toolMetadata: {
            zilobaseToolkit: {
              access: "read",
              connectorId: "google-drive",
              presentation: {
                progressPhrases: ["Opening the Drive file"],
                title: "Read Drive file",
              },
              schemaVersion: 1,
              toolId: "google-drive.file.get",
            },
          },
        },
        toolName: "getGoogleDriveFile",
      }),
      {
        progressPhrases: ["Opening the Drive file"],
        source: "google-drive",
        title: "Read Drive file",
        toolId: "google-drive.file.get",
      },
    );
  });

  test("falls back safely for historical and malformed tool calls", async () => {
    const { resolveIntegrationToolPresentation } = await loadModule(
      "/src/components/ai-elements/integration-tool-presentation.ts",
    );

    assert.deepEqual(
      resolveIntegrationToolPresentation({
        legacySource: "gmail",
        legacyTitle: "Read Gmail message",
        part: { toolMetadata: { zilobaseToolkit: { schemaVersion: 2 } } },
        toolName: "getGmailMessage",
      }),
      {
        progressPhrases: ["Running Read Gmail message"],
        source: "gmail",
        title: "Read Gmail message",
      },
    );

    assert.deepEqual(
      resolveIntegrationToolPresentation({
        part: {},
        toolName: "futureConnector_records_list",
      }),
      {
        progressPhrases: ["Running Future Connector records list"],
        source: undefined,
        title: "Future Connector records list",
      },
    );
  });
}
