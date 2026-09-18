import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EmployeeStatus } from '@prisma/client';

export class EmployeeResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  farmId: string;

  @ApiPropertyOptional()
  userId?: string | null;

  @ApiProperty()
  employeeCode: string;

  @ApiProperty()
  firstName: string;

  @ApiProperty()
  lastName: string;

  @ApiProperty()
  jobTitle: string;

  @ApiPropertyOptional()
  nationalId?: string | null;

  @ApiPropertyOptional()
  phone?: string | null;

  @ApiProperty()
  hireDate: Date;

  @ApiProperty()
  baseSalary: number | string | any;

  @ApiProperty({ enum: EmployeeStatus })
  status: EmployeeStatus;

  @ApiPropertyOptional()
  terminationDate?: Date | null;

  @ApiPropertyOptional()
  terminationReason?: string | null;

  @ApiPropertyOptional()
  bankAccount?: string | null;

  @ApiPropertyOptional()
  notes?: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class EmployeeDeleteResponseDto {
  @ApiProperty({ description: 'Indicates if the employee was deleted (true) or terminated (false)' })
  deleted?: boolean;

  @ApiPropertyOptional()
  id?: string;

  @ApiPropertyOptional({ enum: EmployeeStatus })
  status?: EmployeeStatus;

  @ApiPropertyOptional()
  terminationDate?: Date | null;

  @ApiPropertyOptional()
  terminationReason?: string | null;
}
