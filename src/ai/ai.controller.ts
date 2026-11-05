import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { AiService } from './ai.service';
import { ChatRequestDto } from './dto/chat.dto';
import { ChatResponseDto } from './dto/chat.response';

@Controller('ai')
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Post('chat')
  @HttpCode(200)
  chat(@Body() body: ChatRequestDto): Promise<ChatResponseDto> {
    return this.ai.chat(body);
  }
}
