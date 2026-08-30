const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validarTelefone, validarTexto, validarContato, validarPayload } = require('../app/shared/validation.js');

test('validarTelefone — aceita 10 a 13 dígitos, com ou sem formatação', () => {
  assert.equal(validarTelefone('11999999999'), true);      // 11 dígitos (DDD + 9)
  assert.equal(validarTelefone('1199999999'), true);       // 10 dígitos (DDD + 8)
  assert.equal(validarTelefone('5511999999999'), true);    // 13 dígitos (DDI + DDD + 9)
  assert.equal(validarTelefone('(11) 99999-9999'), true);  // formatado, mesmos dígitos válidos
});

test('validarTelefone — rejeita tamanhos inválidos ou tipos errados', () => {
  assert.equal(validarTelefone('123'), false);
  assert.equal(validarTelefone(''), false);
  assert.equal(validarTelefone('99999999999999'), false); // 14 dígitos
  assert.equal(validarTelefone(null), false);
  assert.equal(validarTelefone(undefined), false);
  assert.equal(validarTelefone(11999999999), false); // número, não string
});

test('validarTexto — aceita string não vazia dentro do limite', () => {
  assert.equal(validarTexto('Olá, [nome]!'), true);
  assert.equal(validarTexto('a'.repeat(4096)), true);
});

test('validarTexto — rejeita vazio, tipo errado ou acima do limite', () => {
  assert.equal(validarTexto(''), false);
  assert.equal(validarTexto(null), false);
  assert.equal(validarTexto(123), false);
  assert.equal(validarTexto('a'.repeat(4097)), false);
});

test('validarContato — aceita objeto com nome e telefone válidos', () => {
  assert.equal(validarContato({ nome: 'João Silva', telefone: '11999999999' }), true);
});

test('validarContato — rejeita nome vazio, ausente ou telefone inválido', () => {
  assert.equal(validarContato({ nome: '', telefone: '11999999999' }), false);
  assert.equal(validarContato({ telefone: '11999999999' }), false);
  assert.equal(validarContato({ nome: 'João', telefone: 'abc' }), false);
  assert.equal(validarContato(null), false);
});

test('validarPayload — aceita payload completo e válido', () => {
  const resultado = validarPayload({
    contatos: [{ nome: 'João', telefone: '11999999999' }],
    texto1: 'Olá, [nome]!',
    imagem: true,
    texto2: 'Qualquer dúvida estamos à disposição!',
  });
  assert.equal(resultado.valido, true);
});

test('validarPayload — aceita payload sem texto2 (opcional)', () => {
  const resultado = validarPayload({
    contatos: [{ nome: 'João', telefone: '11999999999' }],
    texto1: 'Olá!',
  });
  assert.equal(resultado.valido, true);
});

test('validarPayload — rejeita payload sem contatos', () => {
  const resultado = validarPayload({ contatos: [], texto1: 'Olá!' });
  assert.equal(resultado.valido, false);
});

test('validarPayload — rejeita payload com contato inválido na lista', () => {
  const resultado = validarPayload({
    contatos: [{ nome: 'João', telefone: '11999999999' }, { nome: '', telefone: '123' }],
    texto1: 'Olá!',
  });
  assert.equal(resultado.valido, false);
});

test('validarPayload — rejeita texto1 ausente', () => {
  const resultado = validarPayload({ contatos: [{ nome: 'João', telefone: '11999999999' }] });
  assert.equal(resultado.valido, false);
});

test('validarPayload — rejeita payload nulo ou não-objeto', () => {
  assert.equal(validarPayload(null).valido, false);
  assert.equal(validarPayload('string').valido, false);
});

test('validarPayload — rejeita lista de contatos acima do limite', () => {
  const contatos = Array.from({ length: 201 }, (_, i) => ({ nome: `Contato ${i}`, telefone: '11999999999' }));
  const resultado = validarPayload({ contatos, texto1: 'Olá!' });
  assert.equal(resultado.valido, false);
});

test('validarPayload — rejeita campo "imagem" com tipo errado', () => {
  const resultado = validarPayload({
    contatos: [{ nome: 'João', telefone: '11999999999' }],
    texto1: 'Olá!',
    imagem: 'sim',
  });
  assert.equal(resultado.valido, false);
});
