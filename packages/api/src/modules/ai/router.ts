import { createTRPCRouter } from "../../trpc/init";
import { assistantRouter } from "./assistant/router";
import { anomalyFlagRouter } from "./anomaly-flag/router";
import { documentAnomalyRouter } from "./document-anomaly/router";
import { documentRecommendationRouter } from "./document-recommendation/router";
import { hypotheseDiagnosticRouter } from "./hypothese-diagnostic/router";
import { medicationAssistantRouter } from "./medication-assistant/router";
import { ordonnanceRecommendationRouter } from "./ordonnance-recommendation/router";
import { qnaRouter } from "./qna/router";
import { aiSettingsRouter } from "./settings/router";

export const aiRouter = createTRPCRouter({
  assistant: assistantRouter,
  anomalyFlag: anomalyFlagRouter,
  documentAnomaly: documentAnomalyRouter,
  documentRecommendation: documentRecommendationRouter,
  hypotheseDiagnostic: hypotheseDiagnosticRouter,
  medicationAssistant: medicationAssistantRouter,
  ordonnanceRecommendation: ordonnanceRecommendationRouter,
  qna: qnaRouter,
  settings: aiSettingsRouter,
});
