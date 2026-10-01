export function registerRoomTools(actions) {
  const context = document.modelContext;
  if (!context?.registerTool) return () => {};
  const lifecycle = new AbortController();
  const empty = { type: "object", properties: {}, additionalProperties: false };
  const result = () => ({
    content: [{ type: "text", text: JSON.stringify(actions.read()) }],
  });
  const boolSchema = (key) => ({
    type: "object",
    properties: { [key]: { type: "boolean" } },
    required: [key],
    additionalProperties: false,
  });
  const validate = (input, key) => {
    if (!input || typeof input !== "object" || Array.isArray(input))
      throw new Error("需要物件形式的輸入。");
    if (Object.keys(input).some((k) => k !== key))
      throw new Error("包含未支援的輸入欄位。");
    if (key && typeof input[key] !== "boolean")
      throw new Error(`${key} 必須是布林值。`);
  };
  const tools = [
    {
      name: "read_byakuya_state",
      description: "讀取白夜的心情、精神、房間燈光、是否抱著小小熊和休息狀態。",
      inputSchema: empty,
      annotations: { readOnlyHint: true },
      execute(input) {
        validate(input);
        return result();
      },
    },
    {
      name: "pet_byakuya",
      description: "溫柔地摸摸白夜，更新牠的心情與可見表情。",
      inputSchema: empty,
      execute(input) {
        validate(input);
        actions.pet();
        return result();
      },
    },
    {
      name: "hug_byakuya",
      description: "抱抱白夜，讓牠放鬆並恢復精神。",
      inputSchema: empty,
      execute(input) {
        validate(input);
        actions.hug();
        return result();
      },
    },
    {
      name: "set_room_light",
      description: "設定房間燈光。快速反覆切換會讓白夜不開心。",
      inputSchema: boolSchema("on"),
      execute(input) {
        validate(input, "on");
        actions.lamp(input.on);
        return result();
      },
    },
    {
      name: "set_little_bear",
      description: "讓白夜抱著小小熊，或讓小小熊在灰色坐墊上休息。",
      inputSchema: boolSchema("held"),
      execute(input) {
        validate(input, "held");
        actions.bear(input.held);
        return result();
      },
    },
  ];
  for (const tool of tools) {
    try {
      Promise.resolve(
        context.registerTool(
          {
            annotations: { readOnlyHint: false, untrustedContentHint: false },
            ...tool,
          },
          { signal: lifecycle.signal },
        ),
      ).catch(() => {});
    } catch {
      /* Browsers without a usable registry keep the normal interface. */
    }
  }
  return () => lifecycle.abort();
}
