import { createTRPCRouter } from "../../trpc/init";
import { mobileFlowRouter } from "./flow/router";
import { mobileMemoryRouter } from "./memory/router";
import { mobileTodayRouter } from "./today/router";

export const mobileRouter = createTRPCRouter({
  flow: mobileFlowRouter,
  memory: mobileMemoryRouter,
  today: mobileTodayRouter,
});
