/**
 * Preferência do olho da Visão geral (ocultar os valores em dinheiro), guardada num cookie de interface.
 * Fica fora do componente do olho de propósito: constantes exportadas de um arquivo "use client" chegam ao servidor
 * como referência de componente, não como texto, e a página não acharia o cookie.
 */
export const VALUES_COOKIE = "vr-valores";
export const VALUES_HIDDEN = "ocultos";
export const VALUES_VISIBLE = "visiveis";
