import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';

import { TransactionType } from '../../../domain/transaction-type.enum';

export class CreateTransactionDto {
  @ApiProperty({ example: 'acc-123456' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(36)
  accountId: string;

  @ApiProperty({ enum: TransactionType, example: TransactionType.CREDIT })
  @IsEnum(TransactionType)
  type: TransactionType;

  @ApiProperty({ example: 1500.0 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount: number;

  @ApiProperty({ example: 'MXN', minLength: 3, maxLength: 3 })
  @IsString()
  @Length(3, 3)
  currency: string;

  @ApiPropertyOptional({ example: 'Incoming transfer' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;
}
