import { env } from "@doctor.com/env/native";

export const API_URL = env.EXPO_PUBLIC_SERVER_URL;
export const TRPC_URL = `${API_URL}/trpc`;
