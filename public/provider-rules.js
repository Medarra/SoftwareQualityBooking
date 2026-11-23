export function getEligibleProviders(providers, serviceId) {
    return providers.filter(
        provider => provider.serviceIds.includes(serviceId)
    );
}