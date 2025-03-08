"use client";

import { Suspense, useState } from "react";
import {
  PaymentElement,
  useStripe,
  useElements,
  Elements
} from '@stripe/react-stripe-js'
import { Appearance, loadStripe, StripeElementsOptions } from '@stripe/stripe-js'
import { Button, Flex } from "@radix-ui/themes";
import { useSearchParams } from "next/navigation";
import { Checkbox } from "@/components/ui/checkbox"
import Link from "next/link";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

function PaymentForm({ userId }: { userId: string }) {
  const stripe = useStripe();
  const elements = useElements();
  const searchParams = useSearchParams();

  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [checked, setChecked] = useState<boolean>(false);

  const handleCheckBox = (value: boolean) => {
    setChecked(value);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!stripe || !elements) {
      console.error("Stripe or elements not loaded.");
      return;
    }

    setIsLoading(true);

    try {
      const teamId = searchParams.get("teamId");
      const returnUrl = new URL(`${process.env.NEXT_PUBLIC_BASE_URL}/register/pay/status`);
      if (teamId) {
        returnUrl.searchParams.set("teamId", teamId);
      }

      if (userId) {
        returnUrl.searchParams.set("userId", userId);
      }

      const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: returnUrl.toString(),
        },
      });
  
      if (error) {
        if (error.type === "card_error" || error.type === "validation_error") {
          setMessage(error.message ?? "An error occurred.");
        } else {
          setMessage("An unexpected error occurred. Code 427.");
        }
      }
    } catch (err) {
      console.error("Payment error:", err);
      setMessage("Payment failed. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  };
    

  return (
    <Flex direction={'column'} mb={'9'} className="px-[15px] xl:px-[500px]" >
      <form id="payment-form" onSubmit={handleSubmit}>
        <PaymentElement id="payment-element" />
        <Flex direction={'row'} gap={'3'} my={'5'}>
          <Checkbox
            id="terms"
            className="w-6 h-6"
            checked={checked}
            onCheckedChange={handleCheckBox}
          />
          <label
            htmlFor="terms"
            className="text-m font-medium leading-6 peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            This payment covers the 1-month registration fee for you and your teammate. By continuing, you agree to our {" "}
            <Link href={'/rules'} target="_blank" style={{color: 'aqua'}}>official league rules and cancelation policies</Link>. Cancelation policies may differ from 
            the courts where you play.
          </label>
        </Flex>
        <Flex direction={'column'} align={'center'}>
          <Button size={'3'} disabled={isLoading || !stripe || !elements || !checked} id="submit" my={'5'} style={{width: '100%'}}>
            <span id="button-text">
              {isLoading ? <div className="spinner" id="spinner"></div> : "Pay now"}
            </span>
          </Button>
        </Flex>
        {/* Show any error or success messages */}
        {message && <div id="payment-message">{message}</div>}
      </form>
    </Flex>
  );
}

interface CheckoutFormProps {
  clientSecret: string;
  userId: string
}

export default function StripeCheckoutForm({ clientSecret, userId }: CheckoutFormProps) {
  if (!clientSecret) {
    console.error("Missing clientSecret. Cannot render payment form.");
    return <p>Error: Missing payment information.</p>;
  }

  const appearance: Appearance = {
    theme: 'night',
  };

  const options: StripeElementsOptions = {
    appearance,
    clientSecret,
  };

  return (
    <Elements stripe={stripePromise} options={options}>
      <Flex direction={'column'}>
        <Suspense fallback={<p>Loading payment form...</p>}>
          <PaymentForm userId={userId} />
        </Suspense>
      </Flex>
    </Elements>
  );
}