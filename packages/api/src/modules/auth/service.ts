import { betterAuthConfigPlaceholder } from "./better-auth";

export class AuthService {
  readonly config = betterAuthConfigPlaceholder;
}

export const authService = new AuthService();
