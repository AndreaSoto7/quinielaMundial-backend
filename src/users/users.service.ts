import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { stringToSha1 } from '../auth/crypto.utils';
import { UpdateProfileDto } from '../auth/dto/update-profile-dto';
import { User, UserRole } from './entities/User';
import { Repository } from 'typeorm';

@Injectable()
export class UsersService {
  public constructor(
    @InjectRepository(User)
    private repository: Repository<User>,
  ) {}

  findByEmail(email: string): Promise<User | null> {
    return this.repository.findOne({ where: { email } });
  }
  createUser(email: string, password: string, fullName: string): Promise<User> {
    const user = this.repository.create({
      email: email.toLowerCase(),
      password,
      fullName,
      role: UserRole.USUARIO,
    });
    return this.repository.save(user);
  }
  getUserById(id: number): Promise<User | null> {
    return this.repository.findOne({ where: { id } });
  }

  async updateProfile(id: number, dto: UpdateProfileDto): Promise<User> {
    const user = await this.repository.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    if (dto.email) {
      const normalizedEmail = dto.email.toLowerCase();
      const existing = await this.findByEmail(normalizedEmail);
      if (existing && existing.id !== id) {
        throw new ConflictException('El correo electronico ya esta registrado');
      }
      user.email = normalizedEmail;
    }
    if (dto.fullName) user.fullName = dto.fullName;
    if (dto.password) user.password = stringToSha1(dto.password);
    return this.repository.save(user);
  }
}
