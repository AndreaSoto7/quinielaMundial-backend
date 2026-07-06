import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsersModule } from '../users/users.module';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AuthGuard } from './auth.guard';
import { RolesGuard } from './roles.guard';
import { UsersController } from '../users/users.controller';

@Module({
  controllers: [AuthController, UsersController],
  providers: [AuthService, AuthGuard, RolesGuard],
  imports: [
    ConfigModule.forRoot(),
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET || 'default',
      signOptions: { expiresIn: '60m' },
    }),
    UsersModule,
  ],
  exports: [AuthGuard, RolesGuard, UsersModule],
})
export class AuthModule {}
