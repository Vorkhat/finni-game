import { NestFactory } from "@nestjs/core";
import { Module, Controller, Get } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

@Controller()
class AppController {
  @Get("health")
  health() {
    return { status: "ok", service: "finni-api" };
  }
}

@Module({ controllers: [AppController] })
class AppModule {}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const doc = SwaggerModule.createDocument(
    app,
    new DocumentBuilder().setTitle("Питомец Финни API").setVersion("0.1").build()
  );
  SwaggerModule.setup("api/docs", app, doc);
  await app.listen(3000);
}
bootstrap();
