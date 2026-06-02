-- Saneamiento de datos: re-sincroniza el pago de reservas ya COMPLETADAS cuyo
-- payment_status quedó desincronizado (registros heredados).
--
-- Una reserva en estado 'completed' representa siempre un cobro total cerrado
-- (completeReservation marca payment_status='fully_paid', advance_payment=total_price
-- y remaining_payment=0 de forma atómica). Sin embargo, existían registros con
-- status='completed' pero payment_status distinto de 'fully_paid'. Como el módulo
-- de "Pagos > Pendientes" filtra por payment_status, esas reservas:
--   1) aparecían listadas como pendientes, y
--   2) al pulsar "Registrar Pago" el backend respondía 400 ("la reserva ya está
--      completada"), por lo que nunca desaparecían de la lista.
--
-- Esta migración alinea el pago con el estado real de la reserva. Es idempotente:
-- solo toca filas inconsistentes y re-ejecutarla no produce cambios.

UPDATE "reservations"
SET "payment_status"        = 'fully_paid',
    "advance_payment"       = "total_price",
    "remaining_payment"     = 0,
    "date_time_modification" = CURRENT_TIMESTAMP
WHERE "status" = 'completed'
  AND "payment_status" IS DISTINCT FROM 'fully_paid';
