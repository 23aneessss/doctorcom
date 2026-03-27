import { createTRPCRouter } from "../../trpc/init";
import { anomalyFlagRouter } from "./anomaly-flag/router";
import { documentAnomalyRouter } from "./document-anomaly/router";
import { hypotheseDiagnosticRouter } from "./hypothese-diagnostic/router";
import { medicationAssistantRouter } from "./medication-assistant/router";
import { ordonnanceRecommendationRouter } from "./ordonnance-recommendation/router";
import { qnaRouter } from "./qna/router";

export const aiRouter = createTRPCRouter({
  anomalyFlag: anomalyFlagRouter,
  documentAnomaly: documentAnomalyRouter,
  hypotheseDiagnostic: hypotheseDiagnosticRouter,
  medicationAssistant: medicationAssistantRouter,
  ordonnanceRecommendation: ordonnanceRecommendationRouter,
  qna: qnaRouter,
});
