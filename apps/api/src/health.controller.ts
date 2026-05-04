import { Controller, Get } from "@nestjs/common";

@Controller("health")
export class HealthController {
  @Get()
  getHealth() {
    return {
      ok: true,
      service: "university-ai-policy-tracker-api",
      version: "0.1.0",
      checkedAt: new Date().toISOString()
    };
  }
}
