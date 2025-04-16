import { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import Image from 'next/image';
import { Flex } from '@radix-ui/themes';

interface QRCodeGeneratorProps {
  matchId: string;
  selectedLocation: string;
}

const QRCodeGenerator: React.FC<QRCodeGeneratorProps> = ({ matchId, selectedLocation }) => {
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);

  useEffect(() => {
    const generateQRCode = async () => {
      try {
        const url = `${process.env.NEXT_PUBLIC_BASE_URL}/match/${matchId}${selectedLocation ? `?location=${encodeURIComponent(selectedLocation)}` : ""}`;
        const generatedUrl = await QRCode.toDataURL(url, { width: 300, margin: 2 });
        setQrCodeUrl(generatedUrl);
      } catch (error) {
        console.error("Failed to generate QR code:", error);
      }
    };

    generateQRCode();
  }, [matchId, selectedLocation]); // Regenerate QR code if matchId or teamName changes

  return (
    <Flex direction={'column'}>
      {qrCodeUrl ? (
        <Image 
          src={qrCodeUrl} 
          alt="Generated QR Code" 
          width={200} 
          height={200} 
        />
      ) : (
        <p>Generating QR Code...</p>
      )}
    </Flex>
  );
};

export default QRCodeGenerator;
