import { createStore } from "@xstate/store";

export const dommer = createStore({
  context: {
    logs: [] as string[],
  },
  on: {
    LOG: (
      ctx,
      {
        event,
      }: {
        type: "LOG";
        event: any;
      },
    ) => {
      const message = typeof event === "string" ? event : JSON.stringify(event);
      ctx.logs.push(message);
      ctx.logs = ctx.logs.slice(-100);
    },
    CLEAR_LOGS: (ctx) => {
      ctx.logs = [];
    },
  },
});
