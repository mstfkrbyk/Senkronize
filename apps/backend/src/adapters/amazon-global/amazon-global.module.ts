import { Module } from '@nestjs/common';

import { AmazonCaAdapter } from '../amazon-ca/amazon-ca.adapter';
import { AmazonDeAdapter } from '../amazon-de/amazon-de.adapter';
import { AmazonFrAdapter } from '../amazon-fr/amazon-fr.adapter';
import { AmazonJpAdapter } from '../amazon-jp/amazon-jp.adapter';
import { AmazonUkAdapter } from '../amazon-uk/amazon-uk.adapter';

@Module({
  providers: [
    AmazonUkAdapter,
    AmazonDeAdapter,
    AmazonFrAdapter,
    AmazonCaAdapter,
    AmazonJpAdapter,
  ],
  exports: [
    AmazonUkAdapter,
    AmazonDeAdapter,
    AmazonFrAdapter,
    AmazonCaAdapter,
    AmazonJpAdapter,
  ],
})
export class AmazonGlobalModule {}
