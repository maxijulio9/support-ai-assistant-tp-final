# datos operativos de referencia del caso de estudio

*Documento de trabajo para la generación de contenido de la base de conocimiento.
No se publica en Confluence ni forma parte de la kb del sistema ya que se utiliza
únicamente como contexto en los prompts de generación, para mantener consistencia
entre los artículos*

## Identidad
- Nombre: Tokenia
- Tipo de negocio: exchange de criptomonedas
- Países de operación: Argentina, Brasil
- Idiomas de soporte: español, portugues
- Moneda de referencia para cotizaciones: principalmente USD

## Monedas y activos
- Fiat: ARS, BRL, USD
- Criptomonedas: BTC, ETH, USDT, USDC, SOL, DOGE, XLM, ADA, BCH, BNB, XRP

## Métodos de depósito y retiro
- Fiat:
  - Argentina: transferencia bancaria, tarjeta de débito
  - Brasil: PIX, transferencia bancaria 
- Cripto: transferencia onchain a la dirección de depósito asignada por tokenia

## Esquema de comisiones
- Operación de compra/venta cripto: 0,5% por operación
- Depósito fiat vía transferencia bancaria/PIX: sin comisión
- Depósito fiat vía tarjeta de débito: 2%
- Retiro fiat: comisión fija (ARS 500 / BRL 10 / USD 3, según moneda)
- Retiro cripto: fee de red variable (BTC 0,0001 / ETH 0,002 / USDT 0,002)

## Verificación de identidad KYC
La plataforma define tres niveles de verificación, cada uno con requisitos y límites operativos distintos.

- **Nivel 1:** verificación básica con email y número de teléfono. Habilita operaciones de hasta USD 500 mensuales.
- **Nivel 2:** presentación del documento de identidad nacional (DNI en Argentina, CPF en Brasil) junto con una selfie de verificación. Eleva el límite a USD 10.000 mensuales. El tiempo de procesamiento es de 24 a 48 horas hábiles.
- **Nivel 3:** comprobante de domicilio y declaración de origen de fondos. Eleva el límite a USD 50.000 mensuales o sin límite según el perfil del usuario. El procesamiento puede demorar hasta 5 días hábiles.

- Tiempo de procesamiento: 24-48hs hábiles para Nivel 2, hasta 5 días hábiles para Nivel 3
- Motivos frecuentes de rechazo: foto ilegible, documento vencido, datos no coincidentes

## Límites y restricciones
- Los límites de operación están asociados al nivel de KYC del usuario
- Pueden aplicar restricciones adicionales por regulación local en Argentina y Brasil

## Seguridad de la cuenta
- 2FA disponible vía app autenticadora o SMS
- Ante actividad sospechosa, tokenia puede bloquear preventivamente la cuenta
- El usuario puede solicitar el bloqueo voluntario ante sospecha de acceso no autorizado a través de ticket

## Billetera y direcciones
- Cada usuario tiene una dirección de depósito única por criptomoneda
- Enviar por red incorrecta puede resultar en pérdida de fondos
- Las direcciones de retiro deben validarse antes de confirmar la operación

## Canales de soporte
- Portal nativo de JSM
- Sección de soporte en la plataforma web y app móvil, integracon con JSM
- Email con casilla diferenciada por país, se crea en JSM
- Tiempo de respuesta esperado, atención manual: 24-48hs hábiles para consultas de nivel uno

## Información general
- La plataforma opera 24/7 y el equipo de soporte atiende en horario hábil según el país
- Existe un registro interno de incidentes conocidos para fallas técnicas recurrentes

---

**Espacios de Confluence:** TG: KB Tokenia General, TA: KB Tokenia Argentina, TB: KB Tokenia Brasil