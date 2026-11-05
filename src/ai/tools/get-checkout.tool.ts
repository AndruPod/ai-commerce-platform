import { Injectable } from '@nestjs/common';
import { CheckoutService } from '../../checkout/checkout.service';
import { ProductSlugArgs } from './tool-args.dto';
import { CommerceTool, functionTool, PRODUCT_SLUG_PROPERTY } from './tool.types';

@Injectable()
export class GetCheckoutTool implements CommerceTool<ProductSlugArgs> {
  readonly name = 'get_checkout';
  readonly argsClass = ProductSlugArgs;
  readonly definition = functionTool(
    this.name,
    'Checkout hand-off for a product (external system of record): whether a checkout was captured, whether it is usable, blockingIssues (machine-readable reasons) and observedTerms (what the checkout page displayed; not the authoritative offer). URLs are withheld unless usable. Call when the user wants to join, enroll, sign up, buy or pay (after checking enrollment), or asks about the checkout itself; not for purely informational questions. Checkout says nothing about whether enrollment is open.',
    { productSlug: PRODUCT_SLUG_PROPERTY },
    ['productSlug'],
  );

  constructor(private readonly checkout: CheckoutService) {}

  execute({ productSlug }: ProductSlugArgs) {
    return this.checkout.getForSlug(productSlug);
  }
}
