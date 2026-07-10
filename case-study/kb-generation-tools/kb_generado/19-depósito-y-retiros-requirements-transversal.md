---
category: Depósito y retiros
doc_type: requirements
scope: Transversal
space_key: TG
topic: Datos necesarios para gestionar un reclamo de depósito o retiro
---

Para gestionar eficazmente un reclamo relacionado con un depósito o retiro en Tokenia, requerimos la siguiente información por parte del usuario, lo que nos permitirá investigar y solucionar el inconveniente con celeridad.

**Datos Obligatorios:**
- Correo electrónico asociado a su cuenta de Tokenia.
- Tipo de operación: depósito o retiro.
- Tipo de activo involucrado: fiat (ARS, BRL, USD) o criptomoneda (BTC, ETH, USDT, etc.).
- Monto exacto de la operación.
- Fecha y hora aproximada en que se realizó la transacción.
- Un identificador único de la operación. Para transferencias bancarias o PIX, el número de comprobante o ID de transacción. Para criptomonedas, el *TxID* o *hash* de la transacción en la *blockchain*.

**Datos Opcionales y/o Adicionales (según el caso):**
- Método de pago utilizado (transferencia bancaria, PIX, tarjeta de débito, o red de la *blockchain* como ERC-20, BEP-20, etc.).
- Nombre completo del titular de la cuenta de origen/destino, si difiere del nombre en Tokenia (aunque debería coincidir por políticas de KYC).
- Nombre de la entidad bancaria involucrada.
- Número de cuenta bancaria o alias CBU/CVU desde/hacia donde se movieron los fondos.
- Dirección de la billetera cripto de origen o destino.
- Descripción detallada del problema o error que observa en la plataforma.
- Captura de pantalla o comprobante del movimiento realizado, que incluya todos los datos relevantes de la transacción.
- Cualquier otro detalle que considere pertinente para la investigación del caso.