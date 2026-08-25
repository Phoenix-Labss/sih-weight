import { FastifyPluginAsync } from 'fastify';
import { publicVerifyService } from '../services/public-verify.service.js';

export const publicRoutes: FastifyPluginAsync = async (fastify) => {
  // Common handler for verifying certificate via QR reference or certificate number
  const handleVerify = async (request: any, reply: any) => {
    const { qrReference } = request.params;
    const verified = await publicVerifyService.verifyCertificate(qrReference);
    return reply.send(verified);
  };

  // Common handler for public PDF download
  const handlePublicPdf = async (request: any, reply: any) => {
    const { qrReference } = request.params;
    const { buffer, filename } = await publicVerifyService.getPublicPdfBytes(qrReference);

    return reply
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', `attachment; filename="${filename}"`)
      .send(buffer);
  };

  // 1. Primary Public Verification Route
  fastify.get<{
    Params: { qrReference: string };
  }>('/public/certificates/verify/:qrReference', handleVerify);

  // 2. Short / Frontend Scanner URL Aliases
  fastify.get<{
    Params: { qrReference: string };
  }>('/verify/qr/:qrReference', handleVerify);

  fastify.get<{
    Params: { qrReference: string };
  }>('/v/:qrReference', handleVerify);

  // 3. Public PDF Download Routes
  fastify.get<{
    Params: { qrReference: string };
  }>('/public/certificates/:qrReference/pdf', handlePublicPdf);

  fastify.get<{
    Params: { qrReference: string };
  }>('/v/:qrReference/pdf', handlePublicPdf);
};
