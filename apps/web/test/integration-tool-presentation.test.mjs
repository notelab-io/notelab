export function register({ assert, loadModule, test }) {
  test("uses Toolkit metadata for integration tool presentation", async () => {
    const { resolveIntegrationToolPresentation } = await loadModule(
      "/src/components/ai-elements/integration-tool-presentation.ts",
    );

    assert.deepEqual(
      resolveIntegrationToolPresentation({
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
        toolName: "google-drive_file_get",
      }),
      {
        progressPhrases: ["Opening the Drive file"],
        source: "google-drive",
        title: "Read Drive file",
        toolId: "google-drive.file.get",
      },
    );
  });

  test("resolves integration tool presentation from local data", async () => {
    const { resolveIntegrationToolPresentation } = await loadModule(
      "/src/components/ai-elements/integration-tool-presentation.ts",
    );

    assert.deepEqual(
      resolveIntegrationToolPresentation({
        part: {},
        source: "gmail",
        title: "Read Gmail message",
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
