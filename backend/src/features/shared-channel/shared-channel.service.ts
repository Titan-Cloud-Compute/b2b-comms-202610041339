import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { FeatureService } from '../../common/feature';
import { PrismaService } from '../../prisma/prisma.service';
import type { SessionPayload } from '../../auth/session.types';
import type {
  GetApiChannelsResponseDto,
  PostApiChannelsIdMessagesResponseDto,
  PostApiChannelsResponseDto,
} from './shared-channel.dto';

@Injectable()
export class SharedChannelService extends FeatureService {
  constructor(private readonly db: PrismaService) {
    super(db, []);
  }

  private async vendorProfileFor(userId: string) {
    const profile = await this.db.vendorProfile.findUnique({ where: { userId } });
    if (!profile) throw new ForbiddenException('vendor profile required');
    return profile;
  }

  async createChannel(session: SessionPayload, name: string): Promise<PostApiChannelsResponseDto> {
    const profile = await this.vendorProfileFor(session.userId);
    const channel = await this.db.channel.create({
      data: { name, vendorId: profile.id, vendorProfileId: profile.id },
    });
    return { id: channel.id, name: channel.name };
  }

  async listChannels(session: SessionPayload): Promise<GetApiChannelsResponseDto[]> {
    let where = {};
    if (session.role === 'VENDOR') {
      const profile = await this.vendorProfileFor(session.userId);
      where = { vendorId: profile.id };
    }
    const channels = await this.db.channel.findMany({ where, orderBy: { createdAt: 'desc' } });
    return channels.map((c) => ({ id: c.id, name: c.name }));
  }

  async postMessage(
    session: SessionPayload,
    channelId: string,
    body: string,
  ): Promise<PostApiChannelsIdMessagesResponseDto> {
    const channel = await this.db.channel.findUnique({ where: { id: channelId } });
    if (!channel) throw new NotFoundException('channel not found');
    if (session.role === 'VENDOR') {
      const profile = await this.vendorProfileFor(session.userId);
      if (channel.vendorId !== profile.id) throw new ForbiddenException('not a member of this channel');
    }
    const message = await this.db.message.create({
      data: { body, channelId, senderId: session.userId },
    });
    return { id: message.id, body: message.body, channelId: message.channelId };
  }
}
