import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,

    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,

    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customer = await this.customersRepository.findById(customer_id);

    if (!customer) {
      throw new AppError('Customer not found.');
    }

    const checkProductsList = await this.productsRepository.findAllById(
      products,
    );

    if (!checkProductsList.length) {
      throw new AppError('Invalid Products. Please check the provided list.');
    }

    const productsListIds = checkProductsList.map(product => product.id);

    const inexistentProducts = products.filter(
      product => !productsListIds.includes(product.id),
    );

    if (inexistentProducts.length) {
      throw new AppError(`Could not find product ${inexistentProducts[0].id}`);
    }

    function hasDuplicates(list: any): boolean {
      return new Set(list).size !== list.length;
    }

    const duplicates = hasDuplicates(checkProductsList);

    if (duplicates) {
      throw new AppError(
        'Invalid Products List. Check if is there any duplicated product.',
      );
    }
    // const quantities = checkProductsList.map(product => product.quantity);

    // const checkStock = quantities.includes(0);

    // if (checkStock) {
    //   throw new AppError('The chosen product is out of stock.');
    // }

    const productsWithNotEnoughStock = products.filter(
      product =>
        checkProductsList.filter(p => p.id === product.id)[0].quantity <
        product.quantity,
    );

    if (productsWithNotEnoughStock.length) {
      throw new AppError(
        `The quantity ${productsWithNotEnoughStock[0].quantity} is not available for product ${productsWithNotEnoughStock[0].id}. `,
      );
    }

    const serializedProducts = products.map(product => ({
      product_id: product.id,
      quantity: product.quantity,
      price: checkProductsList.filter(p => p.id === product.id)[0].price,
    }));

    const order = await this.ordersRepository.create({
      customer,
      products: serializedProducts,
    });

    const updatedProductsQuantities = products.map(product => ({
      id: product.id,
      quantity:
        checkProductsList.filter(p => p.id === product.id)[0].quantity -
        product.quantity,
    }));

    await this.productsRepository.updateQuantity(updatedProductsQuantities);

    return order;
  }
}

export default CreateOrderService;
