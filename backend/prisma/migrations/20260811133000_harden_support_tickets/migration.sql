-- A database sequence prevents duplicate ticket numbers when requests arrive concurrently.
CREATE SEQUENCE "SupportTicketNumber_seq" AS BIGINT START WITH 1 INCREMENT BY 1;

SELECT setval(
  '"SupportTicketNumber_seq"',
  COALESCE((
    SELECT MAX(substring("ticketNo" FROM '^TLP-([0-9]+)$')::BIGINT)
    FROM "SupportTicket"
    WHERE "ticketNo" ~ '^TLP-[0-9]+$'
  ), 0) + 1,
  false
);
