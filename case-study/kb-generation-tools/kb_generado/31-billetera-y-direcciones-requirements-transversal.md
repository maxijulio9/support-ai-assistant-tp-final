---
category: Billetera y direcciones
doc_type: requirements
scope: Transversal
space_key: TG
topic: Datos necesarios para gestionar una consulta sobre direcciones de wallet
---

El agente de soporte requiere la siguiente información para gestionar de manera eficiente su consulta relacionada con direcciones de billetera:

Datos obligatorios:

- Su correo electrónico o ID de usuario registrado en Tokenia.
- La criptomoneda específica involucrada en la consulta (ej: BTC, ETH, USDT, SOL).
- Si la consulta refiere a una operación de depósito o de retiro.

Si la consulta es sobre una **transacción** (depósito o retiro) que no se procesó correctamente, es fundamental proveer:

- El **Hash de la transacción** (TxID) correspondiente. Este es un identificador único de la operación en la blockchain.
- El monto exacto de la criptomoneda involucrada.
- La fecha y hora aproximada en que se realizó o intentó realizar la operación.
- La dirección de billetera de Tokenia a la que se envió la criptomoneda (para depósitos) o la dirección externa a la que intentó enviar (para retiros).
- La **red blockchain** utilizada para la transacción (ej: ERC-20, BEP-20, TRC-20, Bitcoin, Solana). La selección correcta de la red es crítica.

Datos opcionales, pero altamente recomendados para agilizar la resolución:

- Una captura de pantalla clara del comprobante de la transacción desde la plataforma de origen (para depósitos) o de la pantalla de error en Tokenia.
- Una descripción detallada del inconveniente, incluyendo cualquier mensaje de error que haya recibido.
- Si ya ha iniciado una consulta previa sobre el mismo tema, por favor, indique el número de ticket.