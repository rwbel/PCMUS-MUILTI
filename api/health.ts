interface ServerlessReq {
  method?: string;
}

interface ServerlessRes {
  status: (code: number) => ServerlessRes;
  json: (data: unknown) => void;
}

export default function handler(_req: ServerlessReq, res: ServerlessRes): void {
  res.status(200).json({
    ok: true,
    runtime: 'vercel-serverless',
    websocketSupported: false,
  });
}
