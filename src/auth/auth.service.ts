import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { stringToSha1 } from './crypto.utils';
import { JwtService } from '@nestjs/jwt';
import { UserRegisterResponseDto } from './dto/register-response-dto';
import { UserInfoDto } from './dto/userinfo-dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async signIn(email: string, pass: string): Promise<any> {
    const user = await this.usersService.findByEmail(email.toLowerCase());
    const hashedPassword = stringToSha1(pass);

    if (user?.password !== hashedPassword) {
      throw new UnauthorizedException();
    }
    const payload = { sub: user.id, email: user.email, role: user.role };
    return {
      access_token: await this.jwtService.signAsync(payload),
    };
  }
  async register(
    email: string,
    password: string,
    fullName: string,
  ): Promise<UserRegisterResponseDto> {
    const existingUser = await this.usersService.findByEmail(
      email.toLowerCase(),
    );
    if (existingUser) {
      throw new ConflictException('El correo electrónico ya está registrado');
    }
    const hashedPassword = stringToSha1(password);

    const newUser = await this.usersService.createUser(
      email,
      hashedPassword,
      fullName,
    );
    return {
      id: newUser.id,
      email: newUser.email,
      fullName: newUser.fullName,
      role: newUser.role,
    };
  }
  async getUserProfile(userId: number): Promise<UserInfoDto> {
    const user = await this.usersService.getUserById(userId);

    if (!user) {
      throw new UnauthorizedException();
    }
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
    };
  }

  async updateUserProfile(
    userId: number,
    dto: { fullName?: string; email?: string; password?: string },
  ): Promise<UserInfoDto> {
    const user = await this.usersService.updateProfile(userId, dto);
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
    };
  }
}
