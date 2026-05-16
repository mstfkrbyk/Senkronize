import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

export class PresignedUrlBodyDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @Matches(/^[^/\\]+$/, {
    message: 'Dosya adı / veya \\ içeremez',
  })
  filename!: string;
}
