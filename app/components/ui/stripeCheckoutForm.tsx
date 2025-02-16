"use client";

import { useState } from "react";
import {
  PaymentElement,
  useStripe,
  useElements,
  Elements
} from '@stripe/react-stripe-js'
import { Appearance, loadStripe, StripeElementsOptions } from '@stripe/stripe-js'
import { Button } from "@/components/ui/button";
import { Flex } from "@radix-ui/themes";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

function PaymentForm() {
  const stripe = useStripe();
  const elements = useElements();

  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!stripe || !elements) {
      console.error("Stripe or elements not loaded.");
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${process.env.NEXT_PUBLIC_BASE_URL}/register/pay/success`,
        },
      });
  
      if (error) {
        if (error.type === "card_error" || error.type === "validation_error") {
          setMessage(error.message ?? "An error occurred.");
        } else {
          setMessage("An unexpected error occurred.");
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
    <Flex direction={'column'} align={'center'} mb={'9'}>
      <form id="payment-form" onSubmit={handleSubmit}>
        <PaymentElement id="payment-element" />
        <Button disabled={isLoading || !stripe || !elements} id="submit" style={{width: "80vw", marginTop: "50px"}}>
          <span id="button-text">
            {isLoading ? <div className="spinner" id="spinner"></div> : "Pay now"}
          </span>
        </Button>
        {/* Show any error or success messages */}
        {message && <div id="payment-message">{message}</div>}
      </form>
    </Flex>
    
  );
}

interface CheckoutFormProps {
  clientSecret: string;
}

export default function StripeCheckoutForm({ clientSecret }: CheckoutFormProps) {
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
      <PaymentForm />
    </Elements>
  );
}