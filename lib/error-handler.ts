
export interface SupabaseError {
    message: string
    code?: string
    details?: string
    hint?: string
}


export enum PostgresErrorCode {
    UNIQUE_VIOLATION = '23505',           
    FOREIGN_KEY_VIOLATION = '23503',      
    NOT_NULL_VIOLATION = '23502',         
    CHECK_VIOLATION = '23514',            
    INVALID_TEXT_REPRESENTATION = '22P02', 
    PERMISSION_DENIED = '42501',          
}

export interface ParsedError {
    title: string
    description: string
    code?: string
    isNetworkError: boolean
    isAuthError: boolean
    isValidationError: boolean
    isConstraintError: boolean
}

export function parseSupabaseError(error: any): ParsedError {
    const result: ParsedError = {
        title: 'Erro desconhecido',
        description: 'Ocorreu um erro inesperado. Tente novamente.',
        code: error?.code,
        isNetworkError: false,
        isAuthError: false,
        isValidationError: false,
        isConstraintError: false,
    }

    
    if (error?.message?.includes('Failed to fetch') ||
        error?.message?.includes('NetworkError') ||
        error?.message?.includes('ERR_INTERNET_DISCONNECTED')) {
        result.isNetworkError = true
        result.title = 'Sem conexão'
        result.description = 'Verifique sua conexão com a internet e tente novamente.'
        return result
    }

    
    if (error?.code === '42501' ||
        error?.status === 401 ||
        error?.status === 403 ||
        error?.message?.includes('permission denied') ||
        error?.message?.includes('JWT')) {
        result.isAuthError = true
        result.title = 'Sem autorização'
        result.description = 'Você não tem permissão para realizar esta ação. Faça login novamente.'
        return result
    }

    
    if (error?.code?.startsWith('23')) {
        result.isConstraintError = true

        switch (error.code) {
            case PostgresErrorCode.UNIQUE_VIOLATION:
                
                if (error?.message?.includes('clients_phone_key')) {
                    result.title = 'Telefone já cadastrado'
                    result.description = 'Este número de telefone já está sendo usado por outro cliente.'
                } else if (error?.message?.includes('clients_email_key')) {
                    result.title = 'Email já cadastrado'
                    result.description = 'Este email já está sendo usado por outro cliente.'
                } else {
                    result.title = 'Registro duplicado'
                    result.description = 'Já existe um registro com estes dados. Verifique os campos únicos.'
                }
                break

            case PostgresErrorCode.FOREIGN_KEY_VIOLATION:
                result.title = 'Dependência não encontrada'
                result.description = 'Este registro depende de outro que não existe ou foi removido.'
                break

            case PostgresErrorCode.NOT_NULL_VIOLATION:
                result.title = 'Campo obrigatório'
                result.description = 'Um campo obrigatório não foi preenchido.'
                break

            case PostgresErrorCode.CHECK_VIOLATION:
                result.title = 'Valor inválido'
                result.description = 'Um dos valores fornecidos não atende aos requisitos.'
                break

            default:
                result.title = 'Erro de validação'
                result.description = error.message || 'Os dados fornecidos não são válidos.'
        }
        return result
    }

    
    if (error?.code === PostgresErrorCode.INVALID_TEXT_REPRESENTATION) {
        result.isValidationError = true
        result.title = 'Formato inválido'
        result.description = 'Um dos campos possui formato inválido. Verifique os dados.'
        return result
    }

    
    if (error?.status === 404 || error?.code === 'PGRST116') {
        result.title = 'Registro não encontrado'
        result.description = 'O registro que você está tentando acessar não existe.'
        return result
    }

    
    if (error?.status === 409) {
        result.title = 'Conflito de dados'
        result.description = 'Este registro está sendo modificado por outra pessoa. Tente novamente.'
        return result
    }

    
    if (error?.message) {
        result.title = 'Erro ao processar'
        result.description = error.message
        return result
    }

    return result
}


export function validatePhoneBR(phone: string): { valid: boolean; message?: string } {
    if (!phone || phone.trim() === '') {
        return { valid: false, message: 'Telefone é obrigatório' }
    }

    
    const numbers = phone.replace(/\D/g, '')

    
    if (numbers.length < 10 || numbers.length > 11) {
        return {
            valid: false,
            message: 'Telefone deve ter 10 ou 11 dígitos (incluindo DDD)'
        }
    }

    return { valid: true }
}


export function validateEmail(email: string): { valid: boolean; message?: string } {
    if (!email || email.trim() === '') {
        return { valid: true } 
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
        return { valid: false, message: 'Email inválido' }
    }

    return { valid: true }
}


export function formatPhoneBR(phone: string): string {
    const numbers = phone.replace(/\D/g, '')

    if (numbers.length === 11) {
        // (XX) 9XXXX-XXXX
        return numbers.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
    } else if (numbers.length === 10) {
        // (XX) XXXX-XXXX
        return numbers.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3')
    }

    return phone
}
